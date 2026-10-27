# Original drink image generation pipeline

This is an offline-ready OpenAI Images API client, not proof of a configured image API. It never writes generated images into production paths. The existing `generate-owned-drink-images.py` SVG script is unrelated to this raster campaign.

Install Pillow using `python -m pip install -r tools/drink-image-campaign/requirements.txt` if missing. Run from the repository root:

```sh
python tools/drink-image-campaign/generate.py
python -m unittest discover -s tools/drink-image-campaign -p 'test_*.py'
```

The default command makes no API calls. It reports IMG-034 onward in CSV order, groups of ten, and whether a credential and approved budget exist. `assets/drink-image-review/campaign/generation-plan.json` preserves prompts and exact destinations. The first ten category concepts have source evidence; later entries deliberately require recipe/source verification before execution. Do not turn that gate into a blanket approval. Validate the actual named recipe, presentation, source hash and prompt before setting `verified_recipe` and adding `source_evidence`.

## Current blocker and proposed provider

As checked October 27, 2026, the managed environment has no configured OpenAI secret binding; `OPENAI_API_KEY` is absent. Enforced networking does not include `api.openai.com`. No API request or credential exposure was attempted. The built-in `image_gen.imagegen` tool is raster capable but exposes no underlying model name, rate card or billing estimate. It was not invoked because the user prohibits unapproved charges.

Proposed executable API contract: OpenAI Images API `/v1/images/generations`, model `gpt-image-1`, one PNG at 1536×1024, medium quality, followed by a local WebP export. This API/model configuration is a proposal based on the supported Images API contract; account/model availability, current pricing and actual API execution are **not verified in this environment**. The configured alternatives are 1024×1024 and 1024×1536, low/medium/high quality. Select another currently supported model only after checking its contract and pricing. Never imply a successful endpoint test occurred.

Current per-image price and remaining campaign total cannot be verified from the available credentials, network and rate-card information. There are 103 never-generated IDs (IMG-034–136) and five held earlier slots; no more than 108 one-image requests would be needed if every held slot required a new render and no additional suitable reuse were found. This is a count scenario, not a charge estimate. If verified all-in per-request reservation is R dollars, the corresponding planning amount is 103R, or 108R including five corrections. Input-token charges and any explicitly approved retries must be included. Do not insert an invented provider price or treat the built-in tool as free.

Before execution, configure a secret through the environment's secure settings and authorize the official API domain using the environment configuration workflow. Confirm model access and the current price at https://openai.com/api/pricing/ and the Images API documentation. No secret values belong in this repository, a budget file, logs or chat.

Commercial use is generally permitted under the applicable OpenAI account agreement, policies and law; output is not guaranteed exclusive or copyright-protectable and third-party rights still apply. Confirm the account's current agreement at https://openai.com/policies/services-agreement/ or https://openai.com/policies/terms-of-use/ as applicable. These URLs are references, not a claim that current terms were fetched or that account-specific legal clearance was verified.

## Budget approval and execution

Copy `budget.example.json` to a private work directory. Obtain explicit user approval of the concrete model, size, quality, scope and total estimate. Only then record `approved_by_user: true`, an approval reference, current pricing source/date, total dollars, conservative all-in request reservation and allowed IDs. Do not mark the example file approved. The inventory hash binds approval to the inventory reviewed by the user.

```sh
python tools/drink-image-campaign/generate.py --execute --budget /absolute/path/to/approved-budget.json
```

The client preserves inherited proxies and TLS verification. Credentials come only from `OPENAI_API_KEY`. Each call requests exactly one image. It preserves the original PNG bytes, submitted request, prompt, returned revised prompt if present, native dimensions, SHA-256, candidate WebP, usage data and a ledger. Execution runs sequentially in groups of ten; it stops on missing source verification, source drift, exhausted reservation budget or provider failure. Locking prevents concurrent workers sharing the output directory. Keep one ledger for the approved campaign; a new output directory does not reset actual provider spend. Failed/uncertain calls retain their reservation and are never silently retried.

Reservations enforce a local planning ceiling, **not an upstream billing guarantee**. A verified conservative all-in cost bound and provider-side account/project spending controls are needed to enforce the approved dollar limit. Actual pricing can depend on tokens. The script deliberately records provider usage and does not pretend usage can be priced without current rate information. Review uncertain requests and bills before authorizing any retry or changing the reservation.

Generated candidates remain outside `client/public` under `/workspace/work/drink-image-generation` by default. After each batch inspect each raster individually, verify recipe ingredients/color/glassware/garnish, check for text/logos/artifacts, compare SHA-256 and perceptual hashes against **all existing candidates and pilots**, and inspect actual responsive crops. Do not accept a hash match or automated check as visual approval. Mark rejected files with reasons, preserve originals and only retry with approval if the cost scope changes. Transfer approved candidates into the campaign manifest and exact CSV destination; do not regenerate a suitable existing asset. Update source references, regenerate the drink index with `node --import tsx scripts/generate-drink-index.ts`, confirm image-only generated diffs, run the client build and compare TypeScript diagnostics against baseline. Every generated candidate and integrated slot must retain separate statuses.

The six mocked tests verify budget, allowed IDs, inventory changes, source drift and unknown-outcome retry protection. They make no network calls and incur no charges. No generation run has occurred.
