"""Extract Connecticut wedding-vendor candidates from Overture Maps Places (CDLA-Permissive-2.0 / Apache-2.0).

Read-only: writes a CSV and a category summary. Nothing here touches the ChefSire database.
Usage: python extract_overture_ct.py <release> <out_dir>
"""
import sys, duckdb, pathlib

release, out = sys.argv[1], pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

# Overture place categories relevant to weddings -> ChefSire vendor category.
CATEGORY_MAP = {
    "florist": "Florist",
    "flowers_and_gifts_shop": "Florist",
    "wedding_planning": "Planner",
    "event_planning": "Planner",
    "party_and_event_planning": "Planner",
    "photographer": "Photographer",
    "event_photography": "Photographer",
    "videographer": "Videographer",
    "caterer": "Caterer",
    "bakery": "Bakery",
    "cupcake_shop": "Bakery",
    "custom_cakes_shop": "Bakery",
    "dj_service": "DJ",
    "musician": "Music",
    "bridal_shop": "Bridal",
    "formal_wear_store": "Bridal",
    "venue_and_event_space": "Venue",
    "wedding_chapel": "Venue",
    "banquet_hall": "Venue",
    "party_equipment_rental": "Rentals",
    "limo_services": "Transportation",
    "makeup_artist": "Beauty",
    "hair_salon": "Beauty",
    "officiating_services": "Officiant",
    "winery": "Venue",
}

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
src = f"read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', hive_partitioning=1)"
cols = con.execute(f"SELECT column_name, column_type FROM (DESCRIBE SELECT * FROM {src} LIMIT 0)").fetchall()
for c in cols:
    print("COLUMN", c[0], "::", c[1][:300])
cats = ", ".join(f"'{c}'" for c in CATEGORY_MAP)
mapping = " ".join(f"WHEN '{k}' THEN '{v}'" for k, v in CATEGORY_MAP.items())

con.execute(f"""
CREATE TABLE ct AS
SELECT
  id AS overture_id,
  names.primary AS business_name,
  taxonomy.primary AS source_category,
  CASE taxonomy.primary {mapping} END AS category,
  confidence,
  websites[1] AS website,
  emails[1] AS email,
  operating_status,
  phones[1] AS phone,
  socials[1] AS social,
  addresses[1].freeform AS street,
  addresses[1].locality AS city,
  addresses[1].region AS state,
  addresses[1].postcode AS postcode,
  ST_Y(geometry) AS lat,
  ST_X(geometry) AS lng
FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', hive_partitioning=1)
WHERE bbox.xmin BETWEEN -73.73 AND -71.78
  AND bbox.ymin BETWEEN 40.95 AND 42.06
  AND taxonomy.primary IN ({cats})
  AND coalesce(operating_status, 'open') = 'open'
  AND addresses[1].country = 'US'
  AND upper(addresses[1].region) IN ('CT', 'CONNECTICUT')
""")

con.execute(f"COPY (SELECT * FROM ct ORDER BY category, city, business_name) TO '{out / 'ct_wedding_vendors.csv'}' (HEADER)")
summary = con.execute("""
  SELECT category, source_category, count(*) AS n,
         count(*) FILTER (WHERE confidence >= 0.7) AS n_conf70,
         count(website) AS with_site, count(email) AS with_email, count(phone) AS with_phone
  FROM ct GROUP BY ALL ORDER BY category, n DESC
""").fetchall()
total = con.execute("SELECT count(*), count(*) FILTER (WHERE confidence >= 0.7) FROM ct").fetchone()
lines = [f"# Overture {release}: CT wedding-vendor candidates", "", f"Total: {total[0]} (confidence >= 0.7: {total[1]})", "",
         "| ChefSire category | Overture category | rows | conf>=0.7 | website | email | phone |", "|---|---|---|---|---|---|---|"]
lines += [f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} | {r[5]} | {r[6]} |" for r in summary]
(out / "summary.md").write_text("\n".join(lines) + "\n")
print("\n".join(lines))
