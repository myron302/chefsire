# Original drink photography — preservation system

Tooling that receives, validates and preserves the original, owner-generated ChefSire drink photographs
(generated externally with ChatGPT image generation). It **never** generates, resizes, compresses, converts or
otherwise modifies images, and it does not touch the website, image mappings or recipe images.

Everything lives under `assets/drink-image-review/` (the structure introduced in PR #1322); code is in `scripts/drink-photos/` and needs only Node 22 — no `npm install`.

## Layout

| Path | Purpose |
|---|---|
| `categories.json` | Inventory: canonical category id, title, route, level (hub/leaf), canonical master filename |
| `masters/`, `pilot-records.json`, `README.md` | The five PR #1322 originals and their historical records — **never modified** |
| `batches/<batch-id>/masters/<id>-original.png` | Newly preserved originals, byte-identical to the input |
| `generation-records/<id>--<sha12>.json` | Immutable (write-once, read-only) generation/import record per master |
| `approvals.json` | Append-only owner decisions (approved / rejected / pending), bound to a category **and** SHA-256 |
| `manifest.json` | Generated machine-readable status of every category |
| `REPORT.md` | Generated owner-readable report: completed, pending review, rejected, missing |
| `incoming/` | Git-ignored staging directory for inputs |

Generation records and approval decisions are separate files: recording a decision never edits a generation record.

### Naming

- Category id = lowercase hyphenated name (`drinks-hub`, `tropical-smoothies`, `whiskey-bourbon`).
- Master filename = `<category-id>-original.png`. The five legacy masters keep their historical names (`categories.json` → `masterFilename`).
- Batch id = `[a-z0-9-]`, 3–61 chars, e.g. `hub-and-smoothies-2026-10-20`.

## Inventory status (action needed)

The Codex-verified 51-destination list is **not stored in the repository**, so `categories.json` is derived from
`client/src/data/drinks/route-registry.ts` (45 leaf routes) plus the seven hub pages = **52 entries**, and is marked
`UNRECONCILED`. The two legacy Smoothies/Protein Shakes images are mapped to the `/drinks/smoothies` and
`/drinks/protein-shakes` hubs from their category labels in `pilot-records.json`. Please confirm or send the authoritative list;
reconciling is a data-only edit to `categories.json` (set `reconciliation.status` to `RECONCILED`). `npm run photos:verify` warns until then.

## Getting a batch into the environment (simplest repeatable method)

1. In ChatGPT generate each image; download the PNG and **name it exactly `<category-id>-original.png`**
   (e.g. `drinks-hub-original.png`). Do not edit, crop or re-save the downloads.
2. Put the PNGs in one `.zip` (a folder of PNGs is fine too). Optionally add `batch.json` (below) and/or a `SHA256SUMS` file
   (`sha256sum *.png > SHA256SUMS`) so transfer corruption is detected.
3. Get the zip into the repo checkout, either:
   - **GitHub branch (no CLI needed):** on GitHub create a throwaway branch `drink-photo-inbox/<batch-id>` from `main`, use *Add file → Upload files* to add the zip
     under `assets/drink-image-review/incoming/`, and tell Claude the branch name. GitHub's web uploader limits each file to 25 MB, so use one zip per ~8–10 images
     (PNGs are already compressed, so zipping does not shrink them). Claude fetches the branch and imports from it; the inbox branch is never merged.
   - or attach the zip to the Claude Code session (not guaranteed to reach the container — confirm with `ls`).
4. Import (also available as `npm run photos:import -- …`):

   ```sh
   npm run photos:import -- assets/drink-image-review/incoming/<batch>.zip --batch <batch-id> --dry-run   # validate only
   npm run photos:import -- assets/drink-image-review/incoming/<batch>.zip --batch <batch-id>
   npm run photos:verify
   ```
5. Commit `batches/`, `generation-records/`, `manifest.json`, `REPORT.md` and open a PR. Nothing is wired into the site.

Supported inputs: a directory, `.zip`, `.tar`, `.tar.gz`/`.tgz`. Accepted images: `.png` only (original bytes are preserved verbatim).

### Optional `batch.json`

```json
{
  "defaults": { "provider": "OpenAI image generation", "generatedAt": "2026-10-20" },
  "files": {
    "drinks-hub-original.png": {
      "categoryId": "drinks-hub",
      "expectedSha256": "…",
      "generationId": "8fec4c56-f796-4419-8688-362aa531a134",
      "model": null,
      "prompt": "…",
      "reference": "…"
    }
  }
}
```

Only supply what is actually known. Absent fields are stored as `null`; nothing is invented. `importedAt` is the real import time.

## What the importer enforces

- Rejects: missing files (declared but not delivered), non-PNG files, unknown categories or non-canonical filenames, corrupt/truncated PNGs (signature, every chunk CRC, IEND, decompressible pixel data, trailing bytes),
  hash mismatches (`expectedSha256` / `SHA256SUMS`), duplicate file names, the same image content for two categories (in one batch or across batches),
  files marked `"fixture": true`, unsafe archive paths and links.
- Never overwrites a master. A different image for an already-preserved category is a *conflicting hash* and is rejected — the only exception is a master the owner has explicitly **rejected**, which can be replaced by a new record (the rejected master and its record stay on disk).
- Idempotent: re-importing identical files reports them as `unchanged` and writes nothing. A master left behind by an interrupted run is adopted only if byte-identical.
- Each file is judged independently; the command exits non-zero (2) if anything was rejected, even if other files imported.
- Warns (does not reject) when an image is not approximately 3:2.

## Recording owner decisions

```sh
npm run photos:review -- drinks-hub --sha <sha256> --status approved --by "<owner>" --note "Approved for Main Drinks Hub category photography"
```

Decisions are bound to the exact SHA-256. The last decision for a hash wins; with no decision an image is *pending*.

## Verification

`npm run photos:verify` re-hashes every master, checks the records against the inventory and the unchanged `pilot-records.json`, flags stray files in master directories, and confirms `manifest.json`/`REPORT.md` are current.
`npm run test:photos` runs the automated tests (synthetic fixture PNGs in temp directories — never committed, never presented as ChefSire photographs).

## Usage terms

Images are generated with OpenAI image generation; commercial use is subject to the applicable OpenAI terms and applicable law. Exclusive ownership or copyright protection is not guaranteed.
