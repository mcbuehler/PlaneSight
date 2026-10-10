# Plane Sight

Plane Sight is an air-traffic-control metaphor for coordinating coding agents:
bring actionable sessions to the front, keep agents in flight out of the way,
and make dependencies visible before they collide.

This repository includes the hackathon promo and the pixel-art UI prototype,
merged from `plane-sight-promo` with its Git history preserved. The UI currently
uses illustrative task data; it is not connected to live agent sessions.

## Included compositions

- **PlaneSightPromo** — trimmed presenter footage, captions, and animated logo.
- **PixelAirport** — six animated aircraft, readable flight tooltips with task
  and dependency status, and the terminal check-in sign.
- **PixelAirlines** — top-down Cloud Code and OpenAir artwork.
- **PlaneSightLogo**, **AirportAircraft**, and **AirportControlPanel** — reusable
  components that can also be edited in their own Studio timelines.

## Development setup

The prototype uses experimental Remotion Studio APIs from a development checkout.
The published `4.0.534` packages do not yet include the same component wrappers.
Keep a built Remotion checkout in a sibling directory named `remotion`; all
package links are relative so no developer-specific home path is required.

From the directory where you keep repositories:

```sh
git clone https://github.com/remotion-dev/remotion.git remotion
cd remotion
git checkout 32af7e8f8ac67493ef81498d311af3dc9ca953a6
bun install
bun run build
cd ..
git clone https://github.com/mcbuehler/PlaneSight.git
cd PlaneSight
npm ci
npm run dev
```

The Remotion checkout uses Bun (its package manager version is recorded in its
`package.json`). If you already have that checkout, reuse it instead of cloning
it again. Keep its built packages available while working on this project.

Studio prints its local URL. Open `/PixelAirport` for the UI prototype or
`/PlaneSightPromo` for the video.

```sh
npm run lint          # ESLint and TypeScript
npm run build         # Bundle the compositions into build/
```

## Artwork and footage

Artwork and the caption transcript live in `public/`. The original footage is
stored losslessly in four parts under `media/source-footage/`; every part is
below GitHub's 100 MiB per-file limit. `npm run dev` and `npm run build` restore
and verify the original video automatically. To restore it manually:

```sh
npm run restore-media
```

The restore command verifies SHA-256 checksums. It preserves an existing matching
video and refuses to replace a different file. Run it before invoking Remotion
directly, for example:

```sh
npx remotion still src/index.ts PixelAirport out/airport.png --frame=390
npx remotion render src/index.ts PlaneSightPromo out/plane-sight-promo.mp4
```

Generated previews and exports in `out/`, the bundle in `build/`, and the restored
full-size MP4 are ignored by Git. Keep source edits in `src/` and new artwork in
`public/`.

The webcam source includes the improved audio recording. The promo plays
normalized audio tracks from `public/audio/`; regenerate them with
`npm run normalize-audio` (requires FFmpeg). This also removes the replacement
audio's 2,048-sample delay so the existing cuts and captions remain in sync.
