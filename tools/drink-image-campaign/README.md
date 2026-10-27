# ChefSire raster generation pipeline

Default model: **`gpt-image-2`**, using the official Images API. GPT Image 1 was retired October 23, 2026 and is rejected. The implementation preserves the 28 integrated replacement assets, held artwork and campaign manifest; it only produces new candidates outside production asset directories.

The [verified contract, cost sources and test specification](../../assets/drink-image-review/campaign/gpt-image-2-verification.md) and [account/environment setup instructions](../../assets/drink-image-review/campaign/account-setup.md) are authoritative for this follow-up. The current guide publishes an estimated $0.165 image-output charge per high-quality 1536×1024 image, plus input. The proposed three-image reservation is $0.75, **not approved**. An applicable account standard-rate confirmation is still required; no discounted Batch price is used for synchronous requests.

Install Pillow if missing:

```sh
python -m pip install -r tools/drink-image-campaign/requirements.txt
python -m unittest discover -s tools/drink-image-campaign -p 'test_*.py'
python tools/drink-image-campaign/validate.py
python tools/drink-image-campaign/generate.py --preflight
python tools/drink-image-campaign/generate.py --plan assets/drink-image-review/campaign/test-plan-img034-035-043.json --budget assets/drink-image-review/campaign/test-budget.example.json
```

These commands do not call image generation. The test plan covers workout (IMG-034), coffee (IMG-035) and protein (IMG-043). Skipped IDs remain pending. Every test is a separate raster; the multi-drink workout hero is one same-category composition, never a contact sheet counted as multiple outputs.

After the user's setup/approval, use a private copy of the test budget as described in the setup instructions. `--online-preflight` makes only a read-only model metadata GET. `--execute` is the only mode that generates; it still rejects unapproved budgets, account-rate uncertainty, missing keys, network denial or stale source evidence. The full campaign plan remains ordered from IMG-034; never substitute it for the three-ID test plan when using test approval.

## Model and request policy

Supported IDs: `gpt-image-2` and its documented `gpt-image-2-2026-04-21` snapshot. No model fallback or silent upgrade. Quality is explicitly low/medium/high (default high). Provider automatic sizing/quality is deliberately disabled to keep approvals reproducible. Native PNG (default), WebP and JPEG are available through `--output-format`; the approved budget must match. The client sends one image, opaque background and non-streaming output, avoiding optional preview/partial-image charges. Unsupported legacy request fields are not sent.

`--size WIDTHxHEIGHT` supports custom dimensions satisfying model constraints; the script enforces multiples of 16, ≤3840 edges, ≤3:1 aspect ratio and 655,360–8,294,400 total pixels. The local campaign policy requires `--allow-experimental-size` and matching budget permission above 3,686,400 pixels. Returned native dimensions and format must match exactly. The API supports output compression for JPEG/WebP; the client uses the API default and exports a separate local WebP candidate at quality 87. It never stretches or upscales a raster.

## Spending and provenance

Approval binds the inventory hash, exact plan hash, model, quality, dimensions, native format, allowed IDs, maximum requests and experimental permission. A 4,000-byte prompt limit is used for the current cost scenario. Source file hash drift blocks requests. Budget amounts must be finite and positive. Every attempted request reserves the approved amount before sending; failures or unknown outcomes keep their reservations. No automatic retries occur.

The shared state directory defaults to `/workspace/work/drink-image-campaign-state` and is independent of output directories. Its lock/ledger spans restarts and output-path changes. Reconcile the existing ledger against actual bills before any manual state change. Never create a fresh state directory to avoid prior reservations. Existing task output files also block another request. A project/account enforced spend limit supplements, but does not replace, local controls; provider enforcement can be delayed. Reservations are conservative planning amounts, not guaranteed invoice caps.

Credentials come only from the securely bound `OPENAI_API_KEY`; keys/headers are not saved in requests, prompts or ledgers. Inherited proxy/TLS trust remains enabled. API connectivity is allowed only through the official `api.openai.com` endpoint and supported environment configuration. No credentials, environment dumps or secret files are printed.

Each API attempt requests one raster and preserves original bytes, request parameters, submitted prompt, available provider usage/revised prompt, hashes and dimensions. Byte/pixel checksums and a perceptual difference hash compare against existing integrated, held, pilot and prior output images. A match flags human review; it does not trigger regeneration, automatic acceptance or publication. Every candidate still needs ingredient/presentation, artifact, label/logo and responsive-composition review. Never confuse generated-candidate and integrated statuses. No generation occurred in this follow-up.

To refresh approved image integration later, update exact CSV destinations, source references and the campaign manifest separately, then regenerate indexes with `node --import tsx scripts/generate-drink-index.ts` and verify image-only changes. Never change recipe ingredients, functional routes, authentication, billing, entitlements or migrations to accommodate artwork.
