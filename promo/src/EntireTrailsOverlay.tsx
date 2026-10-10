import {
  AbsoluteFill,
  CanvasImage,
  Interactive,
  type InteractiveTransformProps,
  staticFile,
  useVideoConfig,
} from "remotion";

const EntireTrailsOverlayContent = ({ style }: InteractiveTransformProps) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={style}>
      <CanvasImage
        name="Entire Trails — pixel-font wink"
        src={staticFile("overlays/entire-trails.svg")}
        premountFor={fps}
        style={{
          position: "absolute",
          left: 190,
          top: 300,
          width: 900,
          height: 150,
          objectFit: "contain",
        }}
      />
    </AbsoluteFill>
  );
};

export const EntireTrailsOverlay = Interactive.withSchema({
  Component: EntireTrailsOverlayContent,
  componentName: "EntireTrailsOverlay",
  schema: {},
  wrapInSequence: true,
});
