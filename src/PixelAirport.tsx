import { CanvasImage, Interactive, staticFile, useVideoConfig } from "remotion";

const PixelAirportContent = () => {
  const { fps } = useVideoConfig();

  return (
    <CanvasImage
      name="Runway, taxiways, terminal and tower"
      src={staticFile("airport/pixel-airport.png")}
      premountFor={fps}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        imageRendering: "pixelated",
      }}
    />
  );
};

export const PixelAirport = Interactive.withSchema({
  Component: PixelAirportContent,
  componentName: "PixelAirport",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
