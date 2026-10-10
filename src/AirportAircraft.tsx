import { Interactive, useVideoConfig } from "remotion";
import { CloudCodePlane, OpenAirPlane } from "./PixelAirlines";

type AirportAircraftProps = {
  airline: "Cloud Code" | "OpenAir";
  heading: number;
  labelPosition: "above" | "below";
  flightId: string;
  status: string;
  priority: boolean;
};

const AirportAircraftContent = ({
  airline,
  heading,
  labelPosition,
  flightId,
  status,
  priority,
}: AirportAircraftProps) => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Interactive.Div
        name="Aircraft heading"
        style={{
          position: "absolute",
          left: 30,
          top: 76,
          width: 132,
          height: 132,
          rotate: `${heading}deg`,
          transformOrigin: "50% 50%",
        }}
      >
        {airline === "Cloud Code" ? (
          <CloudCodePlane name="Cloud Code aircraft" premountFor={fps} />
        ) : (
          <OpenAirPlane name="OpenAir aircraft" premountFor={fps} />
        )}
      </Interactive.Div>
      <Interactive.Div
        name="Flight tooltip"
        style={{
          position: "absolute",
          left: 0,
          top: labelPosition === "above" ? 0 : 224,
          width: 192,
          height: 58,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "7px 10px",
          gap: 5,
          textAlign: "left",
          boxSizing: "border-box",
          border: "2px solid",
          borderColor: priority ? "#9a692c" : "#324e41",
          borderLeftWidth: 5,
          backgroundColor: priority ? "#fff0c9" : "#f7f5e9",
          color: airline === "Cloud Code" ? "#173e81" : "#105734",
          fontFamily: "'Courier New', monospace",
          fontWeight: 700,
          fontSize: 18,
          lineHeight: 1,
          letterSpacing: -0.4,
          whiteSpace: "nowrap",
          boxShadow: "3px 3px 0 #334d4133",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span>{airline}</span>
          <span style={{ fontSize: 10, color: "#66736b", letterSpacing: 0 }}>
            {flightId}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: priority ? "#86591c" : "#526557",
            letterSpacing: -0.2,
          }}
        >
          {status}
        </div>
      </Interactive.Div>
    </>
  );
};

export const AirportAircraft = Interactive.withSchema({
  Component: AirportAircraftContent,
  componentName: "AirportAircraft",
  schema: {
    airline: {
      type: "enum",
      default: "Cloud Code",
      description: "Airline",
      variants: { "Cloud Code": {}, OpenAir: {} },
    },
    heading: {
      type: "number",
      default: 90,
      description: "Aircraft heading in degrees",
      hiddenFromList: false,
    },
    labelPosition: {
      type: "enum",
      default: "above",
      description: "Name tag position",
      variants: { above: {}, below: {} },
    },
    flightId: {
      type: "string",
      default: "CC-104",
      description: "Flight ID",
    },
    status: {
      type: "string",
      default: "Build failed · urgent",
      description: "Task status",
    },
    priority: {
      type: "boolean",
      default: false,
      description: "Highlight the next task",
    },
  },
  wrapInSequence: true,
  layout: "absolute-fill",
});
