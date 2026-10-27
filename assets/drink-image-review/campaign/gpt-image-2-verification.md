# GPT Image 2 verification and three-image test

Checked October 27, 2026 against official OpenAI documentation. No image generation or billable API call occurred. This follow-up changes tooling and documentation only. The 28 integrated raster files, five held slots (plus the retained rejected IMG-032 candidate), and existing `manifest.json` are preserved byte-for-byte.

## Verified public contract

The [model page](https://developers.openai.com/api/docs/models/gpt-image-2) lists both `gpt-image-2` and snapshot `gpt-image-2-2026-04-21`, and the Images generations endpoint. The [deprecations page](https://developers.openai.com/api/docs/deprecations) confirms GPT Image 1's October 23 shutdown. Current documentation recommends newer 2.5 models for new integrations, but GPT Image 2 remains listed as supported. This campaign implements the user's requested GPT Image 2, without silently switching to 2.5 or using retired models.

The [Images API reference](https://developers.openai.com/api/reference/resources/images/methods/generate) documents a JSON POST to `https://api.openai.com/v1/images/generations`. This pipeline sends `model`, `prompt`, `n: 1`, `size`, `quality`, `output_format`, `background: opaque`, and `stream: false`. GPT Image output is base64 raster data; do not send the unsupported legacy `response_format`, `style`, or configurable `input_fidelity` fields. Native PNG, JPEG and WebP are supported. Compression 0–100 is available for lossy formats through `output_compression`; this pipeline leaves that at the API default and preserves PNG originals by default. Transparency for GPT Image 2 is documented as preview; the test uses opaque backgrounds.

The [generation guide](https://developers.openai.com/api/docs/guides/image-generation#earlier-gpt-image-models) lists explicit `low`, `medium`, `high`, and automatic quality for GPT Image 2. `xhigh`/`max` belong to 2.5, not GPT Image 2. Dimensions must be multiples of 16, with longest/shortest ratio ≤3, edges ≤3840 and total pixels 655,360–8,294,400. Examples include 1024×1024, 1536×1024, 1024×1536 and 2048×1152. Above 2560×1440 is experimental. For predictable budgeting this pipeline requires explicit quality/dimensions and conservatively requires an additional approval flag above 3,686,400 pixels. It checks returned raster dimensions/format exactly, including custom sizes such as 1536×864, rather than applying the former fixed 1024px minimum edge.

Public model listing is not proof that the user's project can generate with it. No authenticated generation request has been made. Optional read-only model metadata preflight establishes metadata visibility, not all generation entitlements.

## Published estimates and approval proposal

The guide's [comparison table/calculator](https://developers.openai.com/api/docs/guides/image-generation#calculating-costs) gives approximate image-output charges at 1536×1024 of $0.005 low, $0.041 medium and **$0.165 high**. They exclude prompt input. High square 1024×1024 is approximately $0.211; those prices must not be interchanged. This test uses high landscape.

The official [launch announcement](https://community.openai.com/t/introducing-gpt-image-2-available-today-in-the-api-and-codex/1379479) lists standard image-token input/output rates of $8/$30 per million and text-input rate $5 per million. Its date is April 21, not a new account quote. The current [pricing page](https://developers.openai.com/api/docs/pricing) exposes GPT Image 2 in the discounted Batch table ($4 image input/$15 image output; $2.50 text input per million), while its visible standard table emphasizes 2.5. Those Batch rates are not appropriate for this synchronous client. The current guide still supports the $0.165 landscape-output estimate. Because an unambiguous account-specific standard quote is not accessible, execution additionally requires confirming the applicable standard rate and recording that reference; it is not falsely marked verified by an API model GET.

| Scope | Published image-output estimate | Proposed reservation, not yet approved |
|---|---:|---:|
| One high landscape image | $0.165 + input | $0.25 |
| Three-image test | $0.495 + input | **$0.75 total, at most three requests** |
| 103 pending new images | $16.995 + input | $25.75 planning scenario; not approved |
| 108 including five possible corrections | $17.820 + input | $27.00 scenario only; corrections may use edits with extra image-input costs |

The three saved prompts total 2,329 UTF-8 bytes. Using that byte count as a conservative input-token planning scenario at $5/million gives $0.011645 input and about **$0.507 total**. This is not a tokenizer measurement, guaranteed ceiling, price quote or invoice. Each request is limited to 4,000 prompt bytes; the $0.25 reservation includes planning headroom. Actual usage must be reconciled after the test before authorizing more images. Native API account/project spend limits should also be configured: [OpenAI's project guide](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform) distinguishes alerts from enforced limits and notes enforcement is not instantaneous.

`gpt-image-2-pricing.json` preserves these estimates and source links. Both budget examples remain `approved_by_user: false`, `approved_usd: null`, and `account_pricing_confirmed: false`. No prior approval is carried forward from the old proposed model.

## Exactly three test candidates

`test-plan-img034-035-043.json` selects these existing IDs, without renumbering or treating skipped images as done:

| ID | Category and subject | Destination |
|---|---|---|
| IMG-034 | Workout Drinks: sports drink, recovery shake and beet-citrus drink in one category scene | `client/public/images/drinks/hub/workout-drinks.webp` |
| IMG-035 | Coffee: black cold brew with ice, no milk | `client/public/images/drinks/caffeinated/cold-brew.webp` |
| IMG-043 | Protein: berry/almond-milk collagen shake | `client/public/images/drinks/protein-shakes/collagen.webp` |

All three retain complete prompts, source-file hashes and category verification from the existing plan. They cover workout, coffee and protein categories rather than three consecutive coffee entries. IMG-036–042 remain pending, and the full campaign plan still starts at IMG-034. Settings: `gpt-image-2`, high, 1536×1024, one PNG per request, local WebP candidate derivative. No image reference or manifest completion status changes merely because a test is prepared.

After setup and explicit approval, use a private copy of the test budget, not the full-campaign budget:

```sh
python tools/drink-image-campaign/generate.py --preflight
python tools/drink-image-campaign/generate.py --online-preflight
python tools/drink-image-campaign/generate.py --plan assets/drink-image-review/campaign/test-plan-img034-035-043.json --budget /workspace/work/approved-test-budget.json
python tools/drink-image-campaign/generate.py --execute --plan assets/drink-image-review/campaign/test-plan-img034-035-043.json --budget /workspace/work/approved-test-budget.json
```

The first and third commands are offline. The second uses only an authenticated model-metadata GET, without generation. The fourth remains prohibited until credentials, network access, applicable pricing and the test budget are authorized. Candidates stay outside public assets. Review each for subject accuracy, duplicate/similarity flags, text/logos/artifacts and responsive crops before any integration.

## Security and preserved behavior

Approval binds inventory, exact plan bytes, model, quality, size, format, experimental-size permission and allowed IDs. Every API attempt reserves spending before sending; uncertain outcomes keep their reservation and are not retried. A fixed campaign-state directory shares the ledger and lock across output directories; changing output directories cannot reset request history. Finite positive budgets, prompt bounds, exact source hashes and a request-count ceiling are enforced. Existing output files are never overwritten. Pixel hashes, byte hashes and perceptual comparisons against integrated, held, pilot and earlier run images flag duplicates for human review. All originals and duplicate flags are retained; no flag triggers an automatic replacement request or approval.

API keys are read only from the securely bound runtime variable; request files and ledger entries do not contain headers or keys. The fixed official endpoint uses inherited HTTPS proxy/CA settings. No stock images, screenshots, SVG renderings or collages are substituted for generation.
