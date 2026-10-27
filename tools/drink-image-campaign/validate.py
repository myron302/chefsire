#!/usr/bin/env python3
"""Validate campaign accounting and locally integrated raster paths without network access."""
import collections, csv, hashlib, json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
CAMPAIGN = ROOT/'assets/drink-image-review/campaign'
m = json.loads((CAMPAIGN/'manifest.json').read_text())
inventory = CAMPAIGN/m['source_inventory']
assert hashlib.sha256(inventory.read_bytes()).hexdigest() == m['inventory_sha256']
rows = list(csv.DictReader(inventory.open()))
assert len(rows) == len(m['entries']) == 185
assert len({e['id'] for e in m['entries'] if e['id']}) == 136
for row, entry in zip(rows, m['entries']):
    assert all(entry[k] == v for k,v in row.items()), entry['inventory_row']
    if entry.get('output'):
        output = entry['output']; path = ROOT/output['filename']
        assert path.is_file(), path
        assert path.stat().st_size == output['size_bytes'], path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == output['sha256'], path
        with Image.open(path) as im:
            im.load(); assert list(im.size) == output['dimensions']; assert im.format == 'WEBP'
    if entry.get('integration_reference'):
        ref = entry['integration_reference']; assert ref['url'] in (ROOT/ref['file']).read_text()
        assert entry['output']['filename'] == entry['dest']
    if entry['integration_status'] == 'blocked_quality_or_source_conflict':
        assert not (ROOT/entry['dest']).exists(), entry['id']
print(json.dumps({'inventory_rows':len(rows),'actions':dict(collections.Counter(e['action'] for e in m['entries'])),'unique_replacement_assets':sum(bool(e.get('integration_reference')) for e in m['entries']),'integration_status':dict(collections.Counter(e['integration_status'] for e in m['entries']))},indent=2))
