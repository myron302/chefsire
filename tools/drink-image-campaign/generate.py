#!/usr/bin/env python3
"""Sequential original raster generation. Planning is offline; execution requires a reviewed budget file.

No automatic retries or production writes. Run --help for paths. Pillow is required.
"""
import argparse, base64, datetime, decimal, fcntl, hashlib, io, json, os
from pathlib import Path
import urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CAMPAIGN = ROOT / 'assets/drink-image-review/campaign'

def read(path):
    return json.loads(Path(path).read_text())

def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    temp.replace(path)

def selected(plan, start):
    return [x for x in plan['images'] if int(x['id'][4:]) >= start]

def budget_checks(budget, model, quality, size, manifest, ids):
    if budget.get('approved_by_user') is not True or not budget.get('approval_reference'):
        raise ValueError('No user-approved budget and approval reference recorded')
    for key, value in [('model', model), ('quality', quality), ('size', size)]:
        if budget.get(key) != value:
            raise ValueError('Budget does not cover selected ' + key)
    if budget.get('inventory_sha256') != manifest['inventory_sha256']:
        raise ValueError('Budget does not cover this inventory')
    if not budget.get('verified_pricing_source') or not budget.get('pricing_verified_at'):
        raise ValueError('Current pricing must be verified before spending')
    if not set(ids).issubset(set(budget.get('allowed_image_ids', []))):
        raise ValueError('Image selection is outside approved scope')
    unit = decimal.Decimal(str(budget['reserved_usd_per_request']))
    total = decimal.Decimal(str(budget['approved_usd']))
    if unit <= 0 or total <= 0:
        raise ValueError('Positive reservation and total budget required')
    return unit, total

def execute(args, plan, manifest):
    budget = read(args.budget)
    tasks = selected(plan, args.start)
    pending = [x for x in tasks if x['id'] not in {e['id'] for e in manifest['entries'] if e.get('output')}]
    unit, total = budget_checks(budget, args.model, args.quality, args.size, manifest, [x['id'] for x in pending])
    if not os.environ.get('OPENAI_API_KEY'):
        raise ValueError('OPENAI_API_KEY is not configured; do not paste keys into chat or files')
    # Fixed official endpoint, inherited HTTPS proxy and certificate verification preserved.
    endpoint = 'https://api.openai.com/v1/images/generations'
    output = Path(args.output).resolve()
    if output.is_relative_to(ROOT / 'client/public'):
        raise ValueError('Generation output must stay outside production public assets until visual approval')
    output.mkdir(parents=True, exist_ok=True)
    with (output / 'generation.lock').open('a') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        ledger_path = output / 'ledger.json'
        ledger = read(ledger_path) if ledger_path.exists() else {'reservations': []}
        # Reserve every attempted request, including unknown outcomes, so restarts never retry silently.
        attempted = {x['id'] for x in ledger['reservations']}
        pending = [x for x in pending if x['id'] not in attempted]
        for batch_start in range(0, len(pending), 10):
            batch = pending[batch_start:batch_start + 10]
            print('Batch:', ', '.join(x['id'] for x in batch), flush=True)
            for task in batch:
                if task['source_verification'] != 'verified_category_concept' and task['source_verification'] != 'verified_recipe':
                    raise ValueError(task['id'] + ' requires recipe/source verification before generation')
                evidence = task.get('source_evidence', {})
                source_path = (ROOT / evidence.get('path', '')).resolve()
                if not source_path.is_relative_to(ROOT / 'client/src') or not source_path.is_file() or hashlib.sha256(source_path.read_bytes()).hexdigest() != evidence.get('sha256'):
                    raise ValueError(task['id'] + ' source changed or verification evidence missing')
                used = sum(decimal.Decimal(x['reserved_usd']) for x in ledger['reservations'])
                if used + unit > total:
                    raise ValueError('Approved reservation budget would be exceeded; stopped before request')
                rec = {'id': task['id'], 'reserved_usd': str(unit), 'status': 'request_reserved', 'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat()}
                ledger['reservations'].append(rec)
                save(ledger_path, ledger)
                request = {'model': args.model, 'prompt': task['prompt'], 'n': 1, 'size': args.size, 'quality': args.quality, 'output_format': 'png'}
                save(output / (task['id'] + '-request.json'), request)
                req = urllib.request.Request(endpoint, json.dumps(request).encode(), headers={'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY'], 'Content-Type': 'application/json'})
                try:
                    with urllib.request.urlopen(req, timeout=300) as response:
                        payload = json.load(response)
                    if len(payload.get('data', [])) != 1 or not payload['data'][0].get('b64_json'):
                        raise ValueError('Expected exactly one raster image encoded as base64')
                    raw = base64.b64decode(payload['data'][0]['b64_json'], validate=True)
                    im = Image.open(io.BytesIO(raw)); im.load()
                    if im.format != 'PNG' or min(im.size) < 1024:
                        raise ValueError('Unexpected raster format or insufficient native resolution')
                    master = output / (task['id'] + '-original.png')
                    master.write_bytes(raw)
                    # Candidate export only. Visual review, duplicates, crop and ingredients remain a gate.
                    webp = output / (task['id'] + '-candidate.webp')
                    im.convert('RGB').save(webp, 'WEBP', quality=87, method=6)
                    rec.update(status='generated_candidate_pending_visual_review', model=args.model, provider='OpenAI Images API', prompt=task['prompt'], original_sha256=hashlib.sha256(raw).hexdigest(), dimensions=list(im.size), master_path=str(master), candidate_path=str(webp), candidate_sha256=hashlib.sha256(webp.read_bytes()).hexdigest(), size_bytes=webp.stat().st_size, usage=payload.get('usage'), revised_prompt=payload['data'][0].get('revised_prompt'), integration_status='not_integrated')
                    save(ledger_path, ledger)
                    print(task['id'] + ' generated; visual review pending', flush=True)
                except Exception as exc:
                    # Avoid printing response bodies that could contain provider/request details or credentials.
                    rec.update(status='failed_or_outcome_unknown_do_not_auto_retry', error_type=type(exc).__name__)
                    save(ledger_path, ledger)
                    raise ValueError(task['id'] + ' request failed or outcome unknown; reservation retained, no automatic retry') from None


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--plan', default=str(CAMPAIGN / 'generation-plan.json'))
    p.add_argument('--manifest', default=str(CAMPAIGN / 'manifest.json'))
    p.add_argument('--start', type=int, default=34)
    p.add_argument('--model', default='gpt-image-1', help='Proposed model; verify account availability and pricing before execute')
    p.add_argument('--quality', default='medium', choices=['low', 'medium', 'high'])
    p.add_argument('--size', default='1536x1024', choices=['1536x1024', '1024x1536', '1024x1024'])
    p.add_argument('--execute', action='store_true')
    p.add_argument('--budget', default=str(CAMPAIGN / 'budget.example.json'))
    p.add_argument('--output', default=str(ROOT.parent / 'work/drink-image-generation'))
    args = p.parse_args()
    plan, manifest = read(args.plan), read(args.manifest)
    tasks = selected(plan, args.start)
    if not args.execute:
        print(json.dumps({'mode': 'offline_plan_no_API_calls', 'start': args.start, 'count': len(tasks), 'batch_size': 10, 'first_batch': [dict(id=x['id'], subject=x['subject'], dest=x['destination'], source_verification=x['source_verification']) for x in tasks[:10]], 'credential_present': bool(os.environ.get('OPENAI_API_KEY')), 'budget_approved': read(args.budget).get('approved_by_user', False)}, indent=2))
        return
    execute(args, plan, manifest)

if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, BlockingIOError) as exc:
        raise SystemExit(str(exc)) from None
