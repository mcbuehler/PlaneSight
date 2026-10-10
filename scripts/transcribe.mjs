import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import {
  canUseWhisperWebGpu,
  downloadWhisperModel,
  loadWhisperModel,
  toCaptions,
  transcribe,
} from "@remotion/whisper-webgpu";

const support = await canUseWhisperWebGpu();
if (!support.supported) throw new Error(support.detailedReason);
const decoded = spawnSync(
  "ffmpeg",
  [
    "-v",
    "error",
    "-i",
    "public/webcam1791640657618.mp4",
    "-vn",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-f",
    "f32le",
    "pipe:1",
  ],
  { maxBuffer: 32 * 1024 * 1024 },
);
if (decoded.status !== 0) throw new Error(decoded.stderr.toString());
const bytes = new Uint8Array(decoded.stdout);
const channelWaveform = new Float32Array(
  bytes.buffer,
  bytes.byteOffset,
  bytes.byteLength / 4,
);
const model = "small.en";
console.log("Loading local Whisper model:", model);
await downloadWhisperModel({ model });
await using modelHandle = await loadWhisperModel({ model });
console.log("Transcribing", channelWaveform.length / 16000, "seconds");
const result = await transcribe({ channelWaveform, model });
const { captions } = toCaptions({ whisperWebGpuOutput: result });
await mkdir("out/inspection", { recursive: true });
await writeFile(
  "out/inspection/raw-captions.json",
  JSON.stringify(captions, null, 2) + "\n",
);
await writeFile(
  "out/inspection/transcript.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(result.text);
console.log("Saved", captions.length, "word timings");
