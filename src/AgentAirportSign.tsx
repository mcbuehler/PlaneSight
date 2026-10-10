import {
  AbsoluteFill,
  type InteractiveTransformProps,
  CanvasImage,
  Interactive,
  staticFile,
  useVideoConfig,
} from "remotion";

const AgentAirportSignContent = ({ style }: InteractiveTransformProps) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={style}>
      <CanvasImage
        name="Agent Airport International — AAI"
        src={staticFile("branding/agent-airport-international.png")}
        premountFor={fps}
        style={{
          position: "absolute",
          left: 40,
          top: 120,
          width: 1200,
          height: 480,
          objectFit: "contain",
          imageRendering: "pixelated",
        }}
      />
    </AbsoluteFill>
  );
};

export const AgentAirportSign = Interactive.withSchema({
  Component: AgentAirportSignContent,
  componentName: "AgentAirportSign",
  schema: {},
  wrapInSequence: true,
});
