import {
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const EightAgentsIntroContent = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Interactive.Div
      name="Screenshot focus window"
      premountFor={fps}
      style={{
        position: "absolute",
        top: 32,
        left: interpolate(frame, [1.3 * fps, 3.5 * fps], [384.0625, 480], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.42, 0, 0.3, 1),
        }),
        width: interpolate(frame, [1.3 * fps, 3.5 * fps], [511.875, 320], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.42, 0, 0.3, 1),
        }),
        height: 500,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#ffffff",
        boxShadow: "0 12px 36px rgba(21, 31, 44, 0.12)",
        opacity: interpolate(
          frame,
          [0, 0.25 * fps, 7.75 * fps, 8.1 * fps],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        ),
      }}
    >
      <CanvasImage
        name="Eight waiting agents — screenshot zoom"
        src={staticFile("screenshots/eight-agents-waiting.png")}
        premountFor={fps}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 511.875,
          height: 500,
          transformOrigin: "0 0",
          scale: interpolate(frame, [1.3 * fps, 3.5 * fps], [1, 2.816], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.42, 0, 0.3, 1),
            output: "perceptual-scale",
          }),
          translate: interpolate(
            frame,
            [1.3 * fps, 3.5 * fps],
            ["0px 0px", "-12px -708px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.42, 0, 0.3, 1),
            },
          ),
        }}
      />
    </Interactive.Div>
  );
};

export const EightAgentsIntro = Interactive.withSchema({
  Component: EightAgentsIntroContent,
  componentName: "EightAgentsIntro",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
