# Plane Sight promo

Remotion project for the Plane Sight promotional video, including the captioned
presenter footage, animated logo, and separate top-down pixel-art airline
compositions.

The generated artwork and restored source footage are in `public/`. Rendered
previews and exports are written to `out/` and are not tracked in Git.

## Source footage

Entire limits individual Git objects to 128 MiB. The original video is stored
losslessly as smaller parts in `media/source-footage/`, with SHA-256 checksums in
`media/source-footage/manifest.json`. Reassemble it after cloning with:

```console
npm run restore-media
```

This recreates `public/webcam1791640657618.mp4` byte for byte. `npm run dev` and
`npm run build` also restore it automatically. An existing matching video is
left in place; a different existing file is never overwritten. Run the restore
command before invoking Remotion directly, for example with `npx remotion render`.

## Local development setup

This project currently uses local development packages from the Remotion checkout
at `/Users/jonathanburger/remotion`, including experimental Studio features. It
needs that checkout to install and run as configured. Before using it on another
machine, update the local package paths in `package.json` for that machine's
Remotion checkout and regenerate `package-lock.json` with `npm install`.

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i --loglevel=error
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
