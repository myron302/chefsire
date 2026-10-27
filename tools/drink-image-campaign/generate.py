#!/usr/bin/env python3
"""Sequential original raster generation. Planning is offline; execution requires a reviewed budget file.

No automatic retries or production writes. Run --help for paths. Pillow is required.
"""
import argparse, base64, datetime, decimal, fcntl, hashlib, io, json, os
from pathlib import Path
import urllib.request
import urllib.error
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
CAMPAIGN = ROOT / 'assets/drink-image-review/campaign'

SUPPORTED_MODELS = ('gpt-image-2', 'gpt-image-2-2026-04-21')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        raise ValueError('API redirects are refused; credentials remain on the official endpoint')


def api_urlopen(request, timeout):
    # Default proxy and HTTPS handlers retain inherited proxy settings and CA trust.
    return urllib.request.build_opener(NoRedirect()).open(request, timeout=timeout)


def validate_request(model, quality, size, output_format='png', allow_experimental=False):
    if model not in SUPPORTED_MODELS:
        raise ValueError('Unsupported model; gpt-image-1 is retired. Use an explicitly approved GPT Image 2 model')
    if quality not in ('low', 'medium', 'high'):
        raise ValueError('Use explicit low, medium or high quality; auto is not budget reproducible')
    match = re.fullmatch(r'([1-9][0-9]*)x([1-9][0-9]*)', size)
    if not match:
        raise ValueError('Use an explicit WIDTHxHEIGHT; auto is not budget reproducible')
    width, height = map(int, match.groups())
    if any(edge % 16 for edge in (width, height)) or max(width, height) > 3840 or max(width, height) > 3 * min(width, height) or not 655360 <= width * height <= 8294400:
        raise ValueError('Size violates GPT Image 2 edge, pixel, multiple-of-16 or aspect-ratio limits')
    if width * height > 2560 * 1440 and not allow_experimental:
        raise ValueError('Above the campaign non-experimental pixel policy; explicit approval required')
    if output_format not in ('png', 'webp', 'jpeg'):
        raise ValueError('Unsupported output format')
    return width, height


def network_allowed():
    policy_path = Path('/etc/codex/network-policy.json')
    if not policy_path.is_file():
        return False
    policy = read(policy_path)
    if policy.get('version') != 1:
        return False
    http = policy.get('http_network_policy', {})
    return http.get('type') == 'unrestricted' or any(rule.get('host') == 'api.openai.com' for rule in http.get('egress_rules', []))


def preflight(model, online=False):
    result = dict(model=model, credential_present=bool(os.environ.get('OPENAI_API_KEY')), network_policy_allows_api=network_allowed(), account_model_access='not_checked', generation_calls=0)
    if online:
        if not result['credential_present'] or not result['network_policy_allows_api']:
            raise ValueError('Preflight blocked: configure the secret and official API network access first')
        request = urllib.request.Request('https://api.openai.com/v1/models/' + model, headers={'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY']})
        try:
            with api_urlopen(request, timeout=30) as response:
                payload = json.load(response)
            if payload.get('id') not in SUPPORTED_MODELS:
                raise ValueError('Unexpected model response')
        except Exception as exc:
            raise ValueError('Read-only model preflight failed (' + type(exc).__name__ + '); no generation attempted') from None
        result['account_model_access'] = 'model_metadata_access_confirmed_generation_entitlement_not_proven'
    return result


def raster_signature(raw):
    im = Image.open(io.BytesIO(raw)); im.load()
    pixels = im.convert('RGB')
    gray = list(pixels.convert('L').resize((9, 8)).getdata())
    dhash = sum((gray[y * 9 + x] > gray[y * 9 + x + 1]) << (y * 8 + x) for y in range(8) for x in range(8))
    return {'sha256': hashlib.sha256(raw).hexdigest(), 'pixel_sha256': hashlib.sha256(str(pixels.size).encode() + pixels.tobytes()).hexdigest(), 'dhash': f'{dhash:016x}'}


def duplicate_matches(raw, paths):
    signature = raster_signature(raw)
    matches = []
    for path in sorted(set(paths)):
        other = raster_signature(path.read_bytes())
        distance = (int(signature['dhash'], 16) ^ int(other['dhash'], 16)).bit_count()
        if signature['sha256'] == other['sha256'] or signature['pixel_sha256'] == other['pixel_sha256'] or distance <= 8:
            matches.append({'path': str(path), 'exact': signature['sha256'] == other['sha256'] or signature['pixel_sha256'] == other['pixel_sha256'], 'dhash_distance': distance})
    return signature, matches


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
    if not unit.is_finite() or not total.is_finite() or unit <= 0 or total <= 0:
        raise ValueError('Positive reservation and total budget required')
    return unit, total

def execute(args, plan, manifest):
    budget = read(args.budget)
    expected_size = validate_request(args.model, args.quality, args.size, args.output_format, args.allow_experimental_size)
    tasks = selected(plan, args.start)
    if len({x['id'] for x in tasks}) != len(tasks):
        raise ValueError('Duplicate image IDs in generation plan')
    pending = [x for x in tasks if x['id'] not in {e['id'] for e in manifest['entries'] if e.get('output')}]
    unit, total = budget_checks(budget, args.model, args.quality, args.size, manifest, [x['id'] for x in pending])
    for key, value in [('output_format', args.output_format), ('allow_experimental_size', args.allow_experimental_size)]:
        if budget.get(key) != value:
            raise ValueError('Budget does not cover selected ' + key)
    plan_hash = hashlib.sha256(Path(args.plan).read_bytes()).hexdigest()
    if budget.get('plan_sha256') != plan_hash:
        raise ValueError('Generation plan changed since budget approval')
    if budget.get('account_pricing_confirmed') is not True or not budget.get('account_pricing_confirmation_reference'):
        raise ValueError('Confirm the account applicable standard rate before spending')
    max_requests = budget.get('max_requests')
    if isinstance(max_requests, bool) or not isinstance(max_requests, int) or max_requests <= 0:
        raise ValueError('A positive approved request-count limit is required')
    if not os.environ.get('OPENAI_API_KEY'):
        raise ValueError('OPENAI_API_KEY is not configured; do not paste keys into chat or files')
    if not network_allowed():
        raise ValueError('Official API domain is not authorized by the supported environment network policy')
    # Fixed official endpoint, inherited HTTPS proxy and certificate verification preserved.
    endpoint = 'https://api.openai.com/v1/images/generations'
    output = Path(args.output).resolve()
    if output.is_relative_to(ROOT / 'client/public'):
        raise ValueError('Generation output must stay outside production public assets until visual approval')
    output.mkdir(parents=True, exist_ok=True)
    state_dir = Path(args.state_dir).resolve()
    if state_dir.is_relative_to(ROOT / 'client/public'):
        raise ValueError('Spending state cannot be stored in public assets')
    state_dir.mkdir(parents=True, exist_ok=True)
    with (state_dir / 'generation.lock').open('a') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        ledger_path = state_dir / 'ledger.json'
        ledger = read(ledger_path) if ledger_path.exists() else {'reservations': []}
        # Reserve every attempted request, including unknown outcomes, so restarts never retry silently.
        if any(x.get('inventory_sha256') != manifest['inventory_sha256'] for x in ledger['reservations']):
            raise ValueError('Ledger belongs to a different inventory; reconcile it before spending')
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
                if len(ledger['reservations']) >= max_requests:
                    raise ValueError('Approved request-count limit exhausted; no automatic retries')
                if len(task['prompt'].encode('utf-8')) > budget.get('max_prompt_utf8_bytes', 4000):
                    raise ValueError('Prompt exceeds approved input budget bound')
                if list(output.glob(task['id'] + '-*')):
                    raise ValueError(task['id'] + ' output already exists; reconcile before requesting another image')
                used = sum(decimal.Decimal(x['reserved_usd']) for x in ledger['reservations'])
                if used + unit > total:
                    raise ValueError('Approved reservation budget would be exceeded; stopped before request')
                rec = {'id': task['id'], 'reserved_usd': str(unit), 'status': 'request_reserved', 'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'inventory_sha256': manifest['inventory_sha256'], 'plan_sha256': plan_hash}
                ledger['reservations'].append(rec)
                save(ledger_path, ledger)
                request = {'model': args.model, 'prompt': task['prompt'], 'n': 1, 'size': args.size, 'quality': args.quality, 'output_format': args.output_format, 'background': 'opaque', 'stream': False}
                save(output / (task['id'] + '-request.json'), request)
                req = urllib.request.Request(endpoint, json.dumps(request).encode(), headers={'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY'], 'Content-Type': 'application/json'})
                try:
                    with api_urlopen(req, timeout=300) as response:
                        payload = json.load(response)
                    if len(payload.get('data', [])) != 1 or not payload['data'][0].get('b64_json'):
                        raise ValueError('Expected exactly one raster image encoded as base64')
                    raw = base64.b64decode(payload['data'][0]['b64_json'], validate=True)
                    provider_output = output / (task['id'] + '-provider-output.bin')
                    provider_output.write_bytes(raw)
                    rec.update(provider_output_path=str(provider_output), provider_output_sha256=hashlib.sha256(raw).hexdigest())
                    save(ledger_path, ledger)
                    im = Image.open(io.BytesIO(raw)); im.load()
                    if im.format != {'png': 'PNG', 'webp': 'WEBP', 'jpeg': 'JPEG'}[args.output_format] or im.size != expected_size:
                        raise ValueError('Unexpected raster format or insufficient native resolution')
                    master = output / (task['id'] + '-original.' + args.output_format)
                    paths = [ROOT / e['output']['filename'] for e in manifest['entries'] if e.get('output')]
                    paths += list((CAMPAIGN / 'held').rglob('*.webp')) + list((CAMPAIGN.parent / 'masters').glob('*.png'))
                    paths += list(output.glob('*-original.*'))
                    signature, duplicates = duplicate_matches(raw, paths)
                    master.write_bytes(raw)
                    # Candidate export only. Visual review, duplicates, crop and ingredients remain a gate.
                    webp = output / (task['id'] + '-candidate.webp')
                    im.convert('RGB').save(webp, 'WEBP', quality=87, method=6)
                    rec.update(status='generated_candidate_duplicate_flagged' if duplicates else 'generated_candidate_pending_visual_review', duplicate_flags=duplicates, signature=signature, model=args.model, provider='OpenAI Images API', prompt=task['prompt'], original_sha256=hashlib.sha256(raw).hexdigest(), dimensions=list(im.size), master_path=str(master), candidate_path=str(webp), candidate_sha256=hashlib.sha256(webp.read_bytes()).hexdigest(), size_bytes=webp.stat().st_size, usage=payload.get('usage'), revised_prompt=payload['data'][0].get('revised_prompt'), integration_status='not_integrated')
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
    p.add_argument('--model', default='gpt-image-2', choices=SUPPORTED_MODELS)
    p.add_argument('--quality', default='high', choices=['low', 'medium', 'high'])
    p.add_argument('--size', default='1536x1024', help='Explicit model-supported WIDTHxHEIGHT; auto is deliberately disabled')
    p.add_argument('--output-format', choices=['png', 'webp', 'jpeg'], default='png')
    p.add_argument('--allow-experimental-size', action='store_true')
    p.add_argument('--preflight', action='store_true', help='Report safe configuration state without a generation call')
    p.add_argument('--online-preflight', action='store_true', help='Read-only model metadata GET; never generates an image')
    p.add_argument('--state-dir', default=str(ROOT.parent / 'work/drink-image-campaign-state'))
    p.add_argument('--execute', action='store_true')
    p.add_argument('--budget', default=str(CAMPAIGN / 'budget.example.json'))
    p.add_argument('--output', default=str(ROOT.parent / 'work/drink-image-generation'))
    args = p.parse_args()
    validate_request(args.model, args.quality, args.size, args.output_format, args.allow_experimental_size)
    if args.preflight or args.online_preflight:
        print(json.dumps(preflight(args.model, args.online_preflight), indent=2))
        return
    plan, manifest = read(args.plan), read(args.manifest)
    tasks = selected(plan, args.start)
    if not args.execute:
        print(json.dumps({'mode': 'offline_plan_no_API_calls', 'start': args.start, 'count': len(tasks), 'batch_size': 10, 'first_batch': [dict(id=x['id'], subject=x['subject'], dest=x['destination'], source_verification=x['source_verification']) for x in tasks[:10]], 'model': args.model, 'quality': args.quality, 'size': args.size, 'output_format': args.output_format, 'credential_present': bool(os.environ.get('OPENAI_API_KEY')), 'budget_approved': read(args.budget).get('approved_by_user', False)}, indent=2))
        return
    execute(args, plan, manifest)

if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, BlockingIOError, decimal.InvalidOperation) as exc:
        raise SystemExit(str(exc)) from None
