import { Interactive, useVideoConfig } from "remotion";

const AirportControlPanelContent = () => {
  const { fps } = useVideoConfig();
  return (
    <>


      <Interactive.Div
        name="Entire terminal sign"
        premountFor={fps}
        style={{
          position: "absolute",
          left: 118,
          top: 117,
          padding: "5px 9px",
          border: "1px solid #829187",
          backgroundColor: "#dbe2d8",
          color: "#3b543f",
          fontFamily: "'Courier New', monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
        }}
      >
        ENTIRE · CHECK-IN
      </Interactive.Div>

    </>
  );
};

export const AirportControlPanel = Interactive.withSchema({
  Component: AirportControlPanelContent,
  componentName: "AirportControlPanel",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
