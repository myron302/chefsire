/**
 * Re-encodes a video whose codec no browser will decode into one every browser will.
 *
 * WHY THIS IS NEEDED AT ALL
 *
 * An iPhone set to "High Efficiency" records HEVC (H.265). That file is a valid MP4, so it uploads, stores and
 * serves without complaint -- and then desktop Chrome reports readyState 4 and no error while reporting
 * videoWidth 0, because it has no HEVC decoder. The member sees a black box with working controls, and nothing
 * in the stack says why. video-codec.ts detects that case; this module is the part that fixes it.
 *
 * Refusing the upload instead would be worse: a member whose phone is set that way simply could not post video,
 * and would have no idea which setting to change. Re-encoding means their video works and they never have to
 * know what HEVC is.
 *
 * WHAT IT GUARANTEES, AND HOW
 *
 * The output is verified, not assumed. ffmpeg exiting 0 is not evidence: the result is re-read with
 * readVideoCodecs and accepted only if it actually reports H.264. A transcode that "succeeded" into something
 * still undecodable is treated as a failure, because the whole point is a file that plays.
 *
 * EVERY BOUND HERE IS DELIBERATE
 *
 * ffmpeg is spawned with an argument array and no shell, so nothing in a filename can become a command.
 * Input and output paths are ones this process made, never a member-supplied name. The process is killed at a
 * timeout, and `-nostdin` keeps it from blocking on a prompt forever. `-max_muxing_queue_size` and the
 * resolution cap keep a pathological input from exhausting memory, and the duration cap means a long upload
 * cannot occupy a core indefinitely. Failure is always "store nothing and tell the member", never a partial
 * file.
 *
 * NOT A JOB QUEUE, AND HONEST ABOUT IT
 *
 * This runs inside the upload request, which is acceptable at the volume this platform has today: a short clip
 * at veryfast is seconds, and upload requests already wait on a multipart transfer to R2. It will not stay
 * acceptable if video becomes popular -- several concurrent transcodes will contend for CPU with the web
 * process on a single VPS. The replacement at that point is a background worker or a managed service
 * (Cloudflare Stream), not a bigger timeout here.
 */
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { readVideoCodecs } from "./video-codec";

/** Longest a single transcode may run before it is killed. */
const TRANSCODE_TIMEOUT_MS = 180_000;

/** Longest source this will attempt. Past this, the member is told rather than left waiting. */
export const TRANSCODE_MAX_DURATION_SECONDS = 300;

/** Inputs larger than this are refused rather than re-encoded, for the same reason. */
export const TRANSCODE_MAX_INPUT_BYTES = 200 * 1024 * 1024;

/** Longest side of the output, whichever way up the video is. A 4K clip is scaled down; nothing is scaled up. */
const MAX_OUTPUT_LONG_SIDE = 1920;

let ffmpegAvailability: Promise<boolean> | null = null;

/** Runs a bounded command and resolves its exit code, or null if it could not run or timed out. */
function runBounded(command: string, args: string[], timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    } catch {
      resolve(null);
      return;
    }

    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(code);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(null);
    }, timeoutMs);

    // stderr is drained so a chatty encoder cannot fill the pipe and deadlock, and kept only as a tail for logs.
    let stderrTail = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString("utf8")).slice(-2000);
    });
    child.on("error", () => finish(null));
    child.on("close", (code) => {
      if (code !== 0 && stderrTail) console.error(`[video-transcode] ${command} exited ${code}: ${stderrTail.slice(-500)}`);
      finish(code);
    });
  });
}

/** Whether ffmpeg can be run here. Probed once per process; a negative answer is cached too. */
export function isTranscodeAvailable(): Promise<boolean> {
  if (!ffmpegAvailability) {
    ffmpegAvailability = runBounded("ffmpeg", ["-hide_banner", "-version"], 10_000).then((code) => code === 0);
  }
  return ffmpegAvailability;
}

/** Only for tests: forgets the cached probe. */
export function resetTranscodeAvailabilityForTests(): void {
  ffmpegAvailability = null;
}

export type TranscodeOutcome =
  | { kind: "transcoded"; path: string; byteSize: number }
  | { kind: "unavailable" }
  | { kind: "too-large" }
  | { kind: "failed" };

/**
 * Re-encodes `inputPath` to browser-playable H.264/AAC beside it, and verifies the result.
 *
 * The caller owns both files: on any outcome but "transcoded" nothing new exists to clean up, and on success the
 * caller stores the returned path and discards the original.
 */
export async function transcodeToPlayableH264(inputPath: string, byteSize: number): Promise<TranscodeOutcome> {
  if (byteSize > TRANSCODE_MAX_INPUT_BYTES) return { kind: "too-large" };
  if (!(await isTranscodeAvailable())) return { kind: "unavailable" };

  const outputPath = path.join(path.dirname(inputPath), `${path.basename(inputPath)}.h264.mp4`);
  const code = await runBounded(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-t", String(TRANSCODE_MAX_DURATION_SECONDS),
      "-i", inputPath,
      // CAP THE LONG SIDE, NOT THE HEIGHT.
      //
      // This was `scale=-2:'min(1080,ih)'`, which caps HEIGHT -- correct for a landscape clip and wrong for a
      // portrait one. A phone video held upright is 1080x1920, so capping its height at 1080 dragged the width
      // down with it to 608: a member's 1080-wide video was stored 44% narrower than they shot it, and the
      // resolution was simply gone, the original having been replaced. Landscape clips were untouched, so the
      // damage fell only on the orientation most phone video is actually shot in.
      //
      // Fitting inside a square box caps whichever side is longer and leaves the other alone. `min(1920,iw)`
      // and `min(1920,ih)` keep the box no larger than the source, so a small video is never upscaled --
      // force_original_aspect_ratio=decrease alone would happily blow a 640x480 clip up to fill the box.
      // force_divisible_by=2 keeps both dimensions even, which yuv420p requires.
      "-vf", `scale='min(${MAX_OUTPUT_LONG_SIDE},iw)':'min(${MAX_OUTPUT_LONG_SIDE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=bicubic`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      // Baseline-compatible pixel format and a High profile: the combination every browser decodes.
      "-pix_fmt", "yuv420p",
      "-profile:v", "high",
      "-level", "4.1",
      "-c:a", "aac",
      "-b:a", "128k",
      "-ac", "2",
      // The index goes at the front so the video starts playing before it has fully downloaded.
      "-movflags", "+faststart",
      "-max_muxing_queue_size", "1024",
      outputPath,
    ],
    TRANSCODE_TIMEOUT_MS,
  );

  const discard = async () => {
    await fs.promises.unlink(outputPath).catch(() => undefined);
  };

  if (code !== 0) {
    await discard();
    return { kind: "failed" };
  }

  let outputSize: number;
  try {
    outputSize = (await fs.promises.stat(outputPath)).size;
  } catch {
    await discard();
    return { kind: "failed" };
  }
  if (outputSize <= 0) {
    await discard();
    return { kind: "failed" };
  }

  // ffmpeg's exit code is not the assertion. This is: the output must really be H.264 now.
  const report = await readVideoCodecs({ path: outputPath, byteSize: outputSize });
  if (!report || !report.hasBroadlyPlayable || report.hasHevc) {
    await discard();
    return { kind: "failed" };
  }

  return { kind: "transcoded", path: outputPath, byteSize: outputSize };
}
