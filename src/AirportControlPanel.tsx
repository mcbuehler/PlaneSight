import { Interactive, useVideoConfig } from "remotion";

const AirportControlPanelContent = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Interactive.Div
        name="Plane Sight navigation"
        premountFor={fps}
        style={{
          position: "absolute",
          left: 20,
          top: 16,
          width: 1240,
          height: 50,
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
          padding: "0 18px",
          border: "2px solid #304d3f",
          backgroundColor: "#f7f5e9",
          boxShadow: "4px 4px 0 #334d4133",
          color: "#294336",
          fontFamily: "'Courier New', monospace",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <path
            d="M11 2h4v8h4v3h5v4h-9v5h3v2H8v-2h3v-5H2v-4h5v-3h4z"
            fill="#294336"
          />
        </svg>
        <div
          style={{
            marginLeft: 12,
            fontSize: 23,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          Plane Sight
        </div>
        <div
          style={{
            marginLeft: 34,
            alignSelf: "stretch",
            display: "flex",
            alignItems: "center",
            borderBottom: "3px solid #294336",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Airfield
        </div>
        <div style={{ marginLeft: 26, fontSize: 14, color: "#718071" }}>
          Sessions <span style={{ fontWeight: 700 }}>08</span>
        </div>
        <div
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#6c7a6a",
            letterSpacing: 0.5,
          }}
        >
          AGENT AIRPORT INTERNATIONAL
        </div>
        <div
          style={{
            width: 1,
            height: 20,
            margin: "0 20px",
            backgroundColor: "#cbd0be",
          }}
        />
        <div
          style={{
            width: 7,
            height: 7,
            backgroundColor: "#538256",
            marginRight: 8,
          }}
        />
        <div style={{ fontSize: 12 }}>Tower online</div>
      </Interactive.Div>

      <Interactive.Div
        name="Next task clearance"
        premountFor={fps}
        style={{
          position: "absolute",
          left: 430,
          top: 92,
          width: 548,
          height: 106,
          boxSizing: "border-box",
          padding: "13px 16px",
          border: "2px solid #304d3f",
          backgroundColor: "#f7f5e9",
          boxShadow: "4px 4px 0 #334d4133",
          color: "#294336",
          fontFamily: "'Courier New', monospace",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 11,
            letterSpacing: 1,
          }}
        >
          <span style={{ fontWeight: 700 }}>NEXT CLEARANCE</span>
          <span
            style={{ marginLeft: "auto", color: "#7b6538", letterSpacing: 0 }}
          >
            01 / 06 awaiting action
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 12,
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.5 }}>
              CC-104 · Fix failing build
            </div>
            <div style={{ marginTop: 7, fontSize: 11, color: "#697767" }}>
              Unblocks OA-206 · first in line
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              flexShrink: 0,
              padding: "11px 13px",
              backgroundColor: "#294b37",
              border: "2px solid #1c3827",
              boxShadow: "2px 2px 0 #b4c0a9",
              fontSize: 12,
              fontWeight: 700,
              color: "#f7f5e9",
            }}
          >
            Review task →
          </div>
        </div>
      </Interactive.Div>

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

      <Interactive.Div
        name="Airfield status bar"
        premountFor={fps}
        style={{
          position: "absolute",
          left: 20,
          top: 655,
          width: 1240,
          height: 47,
          display: "flex",
          alignItems: "center",
          boxSizing: "border-box",
          padding: "0 18px",
          border: "2px solid #304d3f",
          backgroundColor: "#f7f5e9",
          boxShadow: "4px 4px 0 #334d4133",
          color: "#52654f",
          fontFamily: "'Courier New', monospace",
          fontSize: 12,
          gap: 12,
        }}
      >
        <div style={{ width: 7, height: 7, backgroundColor: "#c79343" }} />
        <div>
          <strong style={{ color: "#324e3d" }}>06 on the ground</strong> ·
          awaiting your attention
        </div>
        <div
          style={{
            width: 1,
            height: 18,
            margin: "0 15px",
            backgroundColor: "#cbd0be",
          }}
        />
        <div>02 in flight · hidden until needed</div>
        <div style={{ marginLeft: "auto" }}>Gemini · control tower</div>
        <div
          style={{
            width: 1,
            height: 18,
            margin: "0 10px",
            backgroundColor: "#cbd0be",
          }}
        />
        <div style={{ color: "#7c886f", fontSize: 11 }}>13:04 LOCAL</div>
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
