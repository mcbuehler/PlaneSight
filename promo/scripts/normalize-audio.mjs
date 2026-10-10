import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const target = { integratedLufs: -16, truePeakDbtp: -1.5, loudnessRangeLu: 7 };
const sources = [
  {
    name: "Presenter narration",
    input: "public/webcam1791640657618.mp4",
    output: "public/audio/presenter-normalized.wav",
    // The enhanced audio adds two AAC frames before the original speech.
    audioOffsetSeconds: 2048 / 48000,
    start: 100 / 30,
    end: 2755 / 30,
  },
  {
    name: "Flight crew",
    input: "public/scenes/team-scene.mp4",
    output: "public/audio/flight-crew-normalized.wav",
    start: 0.7,
    end: 9.9,
  },
];

function ffmpeg(args) {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.error?.message || "ffmpeg failed");
  }
  return result.stderr;
}

function readStats(log) {
  const match = log.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error("Missing loudness measurements");
  return JSON.parse(match[0]);
}

const stereo = "aformat=sample_rates=48000:channel_layouts=stereo";
const normalizer = "loudnorm=I=-16:TP=-1.5:LRA=7";

function inputFilter(audioOffsetSeconds = 0) {
  return audioOffsetSeconds
    ? `${stereo},atrim=start=${audioOffsetSeconds},asetpts=PTS-STARTPTS`
    : stereo;
}

function measure(input, start, end, audioOffsetSeconds = 0) {
  const range = start === undefined ? "" : `atrim=start=${start}:end=${end},`;
  return readStats(
    ffmpeg([
      "-i",
      input,
      "-vn",
      "-af",
      `${inputFilter(audioOffsetSeconds)},${range}${normalizer}:print_format=json`,
      "-f",
      "null",
      "-",
    ]),
  );
}

function summarize(stats) {
  return {
    integratedLufs: Number(stats.input_i),
    truePeakDbtp: Number(stats.input_tp),
    loudnessRangeLu: Number(stats.input_lra),
  };
}

await mkdir("public/audio", { recursive: true });
const clips = [];

for (const source of sources) {
  const firstPass = measure(
    source.input,
    undefined,
    undefined,
    source.audioOffsetSeconds,
  );
  const before = measure(
    source.input,
    source.start,
    source.end,
    source.audioOffsetSeconds,
  );
  const measured = [
    `measured_I=${firstPass.input_i}`,
    `measured_TP=${firstPass.input_tp}`,
    `measured_LRA=${firstPass.input_lra}`,
    `measured_thresh=${firstPass.input_thresh}`,
    `offset=${firstPass.target_offset}`,
  ].join(":");

  ffmpeg([
    "-y",
    "-i",
    source.input,
    "-vn",
    "-af",
    `${inputFilter(source.audioOffsetSeconds)},${normalizer}:${measured}:linear=false,aresample=48000`,
    "-map_metadata",
    "-1",
    "-c:a",
    "pcm_s16le",
    source.output,
  ]);

  const after = measure(source.output, source.start, source.end);
  if (Number(after.input_tp) > -1.3) {
    throw new Error(`${source.name}: true peak exceeds the safety margin`);
  }
  if (Math.abs(Number(after.input_i) - target.integratedLufs) > 0.6) {
    throw new Error(
      `${source.name}: audible section is outside the loudness target`,
    );
  }
  clips.push({
    name: source.name,
    source: source.input,
    normalizedAudio: source.output,
    audioOffsetSeconds: source.audioOffsetSeconds ?? 0,
    audibleRangeSeconds: [source.start, source.end],
    before: summarize(before),
    after: summarize(after),
  });
  console.log(
    `${source.name}: ${before.input_i} → ${after.input_i} LUFS, peak ${after.input_tp} dBTP`,
  );
}

await mkdir("docs", { recursive: true });
await writeFile(
  "docs/audio-levels.json",
  JSON.stringify({ target, sampleRate: 48000, channels: 2, clips }, null, 2) +
    "\n",
);
