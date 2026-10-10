# Plane Sight promo

The hackathon promo video and the airport art, built with Remotion. The live app in
`../app/` uses copies of the airport, airline and logo images from `public/`, in
`app/src/assets/`. Copy a changed image there too if the app should show it.

Run the commands below in `promo/`.

## Included compositions

- **PlaneSightPromo** — trimmed presenter footage, captions, and animated logo.
- **PixelAirport** — six animated aircraft, readable flight tooltips with task
  and dependency status, and the terminal check-in sign.
- **PixelAirlines** — top-down Cloud Code and OpenAir artwork.
- **PlaneSightLogo**, **AirportAircraft**, and **AirportControlPanel** — reusable
  components that can also be edited in their own Studio timelines.

## Development setup

Use Node.js 22 or newer and npm. All Remotion packages are pinned to the published
`4.0.534` release; no separate Remotion checkout or package links are needed.

```sh
cd promo
npm ci
npm run dev          # or, from the repository root: npm run promo
```

Studio prints its local URL. Open `/PixelAirport` for the airport scene or
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
