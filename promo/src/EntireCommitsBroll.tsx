import {
  AbsoluteFill,
  CanvasImage,
  Easing,
  Interactive,
  type InteractiveTransformProps,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const EntireCommitsBrollContent = ({ style }: InteractiveTransformProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{ backgroundColor: "#f7f7f7", overflow: "hidden", ...style }}
    >
      <CanvasImage
        name="PlaneSight commit history in Entire"
        src={staticFile("screenshots/entire-planesight-commits.png")}
        premountFor={fps}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transformOrigin: "0% 0%",
          scale: interpolate(frame, [0, (168 / 30) * fps], [1, 1.12], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.2, 0, 0.4, 1),
            output: "perceptual-scale",
          }),
        }}
      />
    </AbsoluteFill>
  );
};

export const EntireCommitsBroll = Interactive.withSchema({
  Component: EntireCommitsBrollContent,
  componentName: "EntireCommitsBroll",
  schema: {},
  wrapInSequence: true,
});
