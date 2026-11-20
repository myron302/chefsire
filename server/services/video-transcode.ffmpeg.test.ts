/**
 * What the transcode actually produces, run against real ffmpeg.
 *
 * This suite exists because of a bug no amount of reading would have caught. The scale filter capped the output
 * HEIGHT at 1080, which is right for a landscape clip and silently destructive for a portrait one: a phone video
 * held upright is 1080x1920, so capping its height dragged its width from 1080 down to 608. A member's video was
 * stored 44% narrower than they shot it, the original was replaced, and the resolution was gone for good. It
 * reached production because every test fixture generated to that point happened to be landscape.
 *
 * So these assert the output DIMENSIONS for each orientation, not merely that the conversion succeeded. Skipped
 * where ffmpeg is unavailable, the same way the PostgreSQL suites skip without CS_TEST_PG_URL -- a skip says
 * "not checked here", never "fine".
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import { transcodeToPlayableH264 } from "./video-transcode";
import { readVideoCodecs } from "./video-codec";

const run = promisify(execFile);

const hasFfmpeg = await run("ffmpeg", ["-hide_banner", "-version"]).then(() => true).catch(() => false);

if (!hasFfmpeg) {
  test("video transcode (skipped: ffmpeg not installed)", { skip: true }, () => {});
} else {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "transcode-"));
  test.after(() => fs.promises.rm(dir, { recursive: true, force: true }));

  /** Builds a one-second HEVC source of the given size, which is what the conversion path is for. */
  async function hevcSource(name: string, width: number, height: number): Promise<string> {
    const file = path.join(dir, `${name}.mp4`);
    await run("ffmpeg", [
      "-hide_banner", "-v", "error", "-f", "lavfi",
      "-i", `testsrc=size=${width}x${height}:rate=10:duration=1`,
      "-c:v", "libx265", "-tag:v", "hvc1", "-pix_fmt", "yuv420p", "-y", file,
    ]);
    return file;
  }

  async function dimensionsOf(file: string): Promise<{ width: number; height: number }> {
    const { stdout } = await run("ffprobe", [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file,
    ]);
    const [width, height] = stdout.trim().split(",").map(Number);
    return { width, height };
  }

  async function convert(name: string, width: number, height: number) {
    const source = await hevcSource(name, width, height);
    const outcome = await transcodeToPlayableH264(source, (await fs.promises.stat(source)).size);
    assert.equal(outcome.kind, "transcoded", `${name} should convert`);
    if (outcome.kind !== "transcoded") throw new Error("unreachable");
    const dimensions = await dimensionsOf(outcome.path);
    const codecs = await readVideoCodecs({ path: outcome.path, byteSize: outcome.byteSize });
    await fs.promises.unlink(outcome.path).catch(() => undefined);
    return { ...dimensions, codecs };
  }

  test("a portrait phone video keeps its full width", async () => {
    // THE REGRESSION. 1080x1920 is what a phone records held upright. The old filter returned 608x1080.
    const out = await convert("portrait", 1080, 1920);
    assert.deepEqual({ width: out.width, height: out.height }, { width: 1080, height: 1920 });
  });

  test("a landscape video is unchanged", async () => {
    const out = await convert("landscape", 1920, 1080);
    assert.deepEqual({ width: out.width, height: out.height }, { width: 1920, height: 1080 });
  });

  test("an oversized clip is scaled down on its long side, either way up", async () => {
    const wide = await convert("uhd-landscape", 3840, 2160);
    assert.deepEqual({ width: wide.width, height: wide.height }, { width: 1920, height: 1080 });

    const tall = await convert("uhd-portrait", 2160, 3840);
    assert.deepEqual({ width: tall.width, height: tall.height }, { width: 1080, height: 1920 },
      "the cap applies to the long side, so a tall clip loses height rather than width");
  });

  test("a small video is never scaled up", async () => {
    // force_original_aspect_ratio=decrease on a fixed box would enlarge this to fill it, inventing detail that
    // was never recorded and making the file bigger for nothing.
    const out = await convert("small", 640, 480);
    assert.deepEqual({ width: out.width, height: out.height }, { width: 640, height: 480 });
  });

  test("the output is H.264 and carries no HEVC track, whatever the shape", async () => {
    for (const [name, width, height] of [["p", 1080, 1920], ["l", 1920, 1080]] as const) {
      const out = await convert(`codec-${name}`, width, height);
      assert.equal(out.codecs?.hasBroadlyPlayable, true, name);
      assert.equal(out.codecs?.hasHevc, false, name);
    }
  });

  test("a scale that lands on an odd number is nudged to an even one", async () => {
    // An odd dimension makes libx264 fail outright, so a filter that can produce one is a conversion that can
    // refuse a member's video for a reason they cannot act on.
    //
    // The odd number has to come from the SCALING, not the source: an odd-sized source cannot be built here at
    // all, because yuv420p needs even dimensions to encode in the first place. 3840x2162 halves to 1920x1081,
    // so this is the case force_divisible_by=2 exists for.
    const out = await convert("odd-after-scaling", 3840, 2162);
    assert.equal(out.width % 2, 0, "width");
    assert.equal(out.height % 2, 0, "height");
    // 1920x1082, not 1920x1080: the nudge goes to the nearest even number, it does not round down to a
    // familiar one. The invariants worth asserting are the ones the filter actually promises -- even sides, a
    // capped long side, and an aspect ratio within a pixel of the source -- not a figure that looks tidy.
    assert.ok(Math.max(out.width, out.height) <= 1920, "long side capped");
    assert.ok(Math.abs(out.width / out.height - 3840 / 2162) < 0.005, "aspect preserved");
  });
}
