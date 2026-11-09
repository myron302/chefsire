"""Extract Connecticut wedding-vendor candidates from Overture Maps Places.

Overture Places is openly licensed (CDLA-Permissive-2.0, with Foursquare-sourced records under Apache-2.0),
so the rows may be stored and shown. This script is read-only: it writes a JSON file and a summary and never
touches the ChefSire database. The server imports the JSON as unclaimed listings.

Usage: python extract_overture_ct.py <release> <out_dir>
"""
import json, pathlib, sys

import duckdb

release, out = sys.argv[1], pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

# Overture taxonomy.primary -> ChefSire vendor category (free text; the client maps it to a filter).
CATEGORY_MAP = {
    "florist": "Florist",
    "wholesale_florist": "Florist",
    "flowers_and_gifts_store": "Florist",  # name must look like a florist (below)
    "wedding_planning": "Planner",
    "party_and_event_planning": "Planner",
    "event_or_party_service": "Planner",
    "event_photography_service": "Photographer",
    "photography_service": "Photographer",
    "session_photography_service": "Photographer",
    "photographer": "Photographer",
    "videographer": "Videographer",
    "caterer": "Caterer",
    "bakery": "Bakery & Cakes",
    "custom_cakes_shop": "Bakery & Cakes",
    "cupcake_shop": "Bakery & Cakes",
    "patisserie_cake_shop": "Bakery & Cakes",
    "dj_service": "DJ",
    "musician": "Music",
    "band_orchestra_symphony": "Music",
    "bridal_shop": "Bridal",
    "makeup_artist": "Beauty",
    "party_equipment_rental": "Rentals",
    "photo_booth_rental": "Rentals",
    "audiovisual_equipment_rental": "Rentals",
    "limo_service": "Transportation",
    "event_venue": "Venue",
    "winery": "Venue",
}

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
src = f"read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', hive_partitioning=1)"
cats = ", ".join(f"'{c}'" for c in CATEGORY_MAP)
mapping = " ".join(f"WHEN '{k}' THEN '{v}'" for k, v in CATEGORY_MAP.items())

con.execute(f"""
CREATE TABLE raw AS
SELECT
  id AS source_id,
  trim(names.primary) AS business_name,
  taxonomy.primary AS source_category,
  CASE taxonomy.primary {mapping} END AS category,
  confidence,
  websites[1] AS website,
  emails[1] AS email,
  phones[1] AS phone,
  addresses[1].freeform AS street,
  trim(addresses[1].locality) AS city,
  addresses[1].postcode AS postcode,
  round(ST_Y(geometry), 6) AS lat,
  round(ST_X(geometry), 6) AS lng
FROM {src}
WHERE bbox.xmin BETWEEN -73.73 AND -71.78
  AND bbox.ymin BETWEEN 40.95 AND 42.06
  AND taxonomy.primary IN ({cats})
  AND coalesce(operating_status, 'open') = 'open'
  AND addresses[1].country = 'US'
  AND upper(addresses[1].region) IN ('CT', 'CONNECTICUT')
""")

# Keep confident, locatable rows; a gift shop counts only when its name says florist; one row per name+city.
con.execute(r"""
CREATE TABLE ct AS
SELECT * EXCLUDE (rn) FROM (
  SELECT *, row_number() OVER (PARTITION BY lower(business_name), lower(city) ORDER BY confidence DESC) rn
  FROM raw
  WHERE confidence >= 0.7
    AND business_name IS NOT NULL AND length(business_name) >= 2
    AND city IS NOT NULL AND length(city) >= 2
    AND (source_category <> 'flowers_and_gifts_store'
         OR regexp_matches(lower(business_name), 'flor|flower|bloom|petal|blossom|rose|botanical'))
) WHERE rn = 1
""")

rows = con.execute("SELECT * FROM ct ORDER BY category, city, business_name").fetchall()
cols = [d[0] for d in con.description]
records = []
for r in rows:
    rec = dict(zip(cols, r))
    rec.pop("confidence", None)
    rec.pop("source_category", None)
    rec["state"] = "CT"
    records.append({k: v for k, v in rec.items() if v is not None})

payload = {
    "source": "overture",
    "release": release,
    "license": "Overture Maps Places: CDLA-Permissive-2.0 (some records Apache-2.0). https://docs.overturemaps.org/attribution/",
    "region": "CT",
    "listings": records,
}
(out / "wedding-vendors-ct.json").write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n")

summary = con.execute("""
  SELECT category, count(*) n, count(website) site, count(email) email, count(phone) phone
  FROM ct GROUP BY 1 ORDER BY 2 DESC
""").fetchall()
lines = [f"# Overture {release}: CT wedding vendors kept", "", f"Total: {len(records)}", "",
         "| Category | rows | website | email | phone |", "|---|---|---|---|---|"]
lines += [f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} |" for r in summary]
(out / "summary.md").write_text("\n".join(lines) + "\n")
print("\n".join(lines))
