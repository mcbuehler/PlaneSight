import { CanvasImage, Interactive, staticFile, useVideoConfig } from "remotion";

const CloudCodePlaneContent = () => {
  const { fps } = useVideoConfig();

  return (
    <CanvasImage
      name="Cloud Code plane"
      src={staticFile("airlines/cloud-code-plane-top-down.png")}
      premountFor={fps}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        imageRendering: "pixelated",
      }}
    />
  );
};

export const CloudCodePlane = Interactive.withSchema({
  Component: CloudCodePlaneContent,
  componentName: "CloudCodePlane",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});

const OpenAirPlaneContent = () => {
  const { fps } = useVideoConfig();

  return (
    <CanvasImage
      name="OpenAir plane"
      src={staticFile("airlines/openair-plane-top-down.png")}
      premountFor={fps}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        imageRendering: "pixelated",
      }}
    />
  );
};

export const OpenAirPlane = Interactive.withSchema({
  Component: OpenAirPlaneContent,
  componentName: "OpenAirPlane",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});

export const PixelAirlines = () => {
  const { fps } = useVideoConfig();

  return (
    <>
      <CloudCodePlane
        name="Cloud Code"
        premountFor={fps}
        width={560}
        height={560}
        style={{ position: "absolute", left: 50, top: 80 }}
      />
      <OpenAirPlane
        name="OpenAir"
        premountFor={fps}
        width={560}
        height={560}
        style={{ position: "absolute", left: 670, top: 80 }}
      />
    </>
  );
};
