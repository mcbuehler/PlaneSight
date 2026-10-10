import { CanvasImage, Interactive, staticFile, useVideoConfig } from "remotion";

const AgentAirportSignContent = () => {
  const { fps } = useVideoConfig();

  return (
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
  );
};

export const AgentAirportSign = Interactive.withSchema({
  Component: AgentAirportSignContent,
  componentName: "AgentAirportSign",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
