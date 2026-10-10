import {
  CanvasImage,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AirportAircraft } from "./AirportAircraft";
import { AirportControlPanel } from "./AirportControlPanel";

const PixelAirportContent = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
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
      <AirportAircraft
        name="Cloud Code 1 — first in line"
        flightId="CC-104"
        status="Build failed · urgent"
        priority={true}
        airline="Cloud Code"
        labelPosition="above"
        premountFor={fps}
        width={192}
        height={286}
        heading={interpolate(frame, [2.2 * fps, 2.8 * fps], [0, 90], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        style={{
          position: "absolute",
          left: -96,
          top: -142,
          translate: interpolate(
            frame,
            [
              0.8 * fps,
              2.2 * fps,
              2.35 * fps,
              2.5 * fps,
              2.65 * fps,
              2.8 * fps,
              4.1 * fps,
            ],
            [
              "1058px 473px",
              "1058px 362px",
              "1059.3px 355.5px",
              "1063px 350px",
              "1068.5px 346.3px",
              "1075px 345px",
              "1130px 345px",
            ],
            {
              easing: [
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.bezier(0, 0, 0.35, 1),
              ],
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      />
      <AirportAircraft
        name="OpenAir 1 — second in line"
        flightId="OA-202"
        status="Ready for review"
        priority={false}
        airline="OpenAir"
        labelPosition="above"
        premountFor={fps}
        width={192}
        height={286}
        heading={interpolate(frame, [3.4 * fps, 4 * fps], [0, 90], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        style={{
          position: "absolute",
          left: -96,
          top: -142,
          translate: interpolate(
            frame,
            [
              2 * fps,
              3.4 * fps,
              3.55 * fps,
              3.7 * fps,
              3.85 * fps,
              4 * fps,
              7.2 * fps,
            ],
            [
              "626px 473px",
              "626px 362px",
              "627.3px 355.5px",
              "631px 350px",
              "636.5px 346.3px",
              "643px 345px",
              "920px 345px",
            ],
            {
              easing: [
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.bezier(0, 0, 0.35, 1),
              ],
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      />
      <AirportAircraft
        name="Cloud Code 2 — third in line"
        flightId="CC-108"
        status="Tests passed · ready"
        priority={false}
        airline="Cloud Code"
        labelPosition="above"
        premountFor={fps}
        width={192}
        height={286}
        heading={interpolate(frame, [5.4 * fps, 6 * fps], [0, 90], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        style={{
          position: "absolute",
          left: -96,
          top: -142,
          translate: interpolate(
            frame,
            [
              4 * fps,
              5.4 * fps,
              5.55 * fps,
              5.7 * fps,
              5.85 * fps,
              6 * fps,
              10.6 * fps,
            ],
            [
              "206px 473px",
              "206px 362px",
              "207.3px 355.5px",
              "211px 350px",
              "216.5px 346.3px",
              "223px 345px",
              "710px 345px",
            ],
            {
              easing: [
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.bezier(0, 0, 0.35, 1),
              ],
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      />
      <AirportAircraft
        name="OpenAir 2 — right taxiway queue"
        flightId="OA-206"
        status="Waiting on CC-104"
        priority={false}
        airline="OpenAir"
        labelPosition="below"
        premountFor={fps}
        width={192}
        height={286}
        heading={interpolate(frame, [3.1 * fps, 3.7 * fps], [90, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        style={{
          position: "absolute",
          left: -96,
          top: -142,
          translate: interpolate(
            frame,
            [
              1.4 * fps,
              3.1 * fps,
              3.25 * fps,
              3.4 * fps,
              3.55 * fps,
              3.7 * fps,
              4 * fps,
            ],
            [
              "890px 486px",
              "1048px 486px",
              "1051.8px 485.2px",
              "1055.1px 483.1px",
              "1057.2px 479.8px",
              "1058px 476px",
              "1058px 473px",
            ],
            {
              easing: [
                Easing.bezier(0.4, 0, 1, 1),
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
              ],
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      />
      <AirportAircraft
        name="Cloud Code 3 — middle taxiway queue"
        flightId="CC-112"
        status="Needs your input"
        priority={false}
        airline="Cloud Code"
        labelPosition="below"
        premountFor={fps}
        width={192}
        height={286}
        heading={interpolate(frame, [4.3 * fps, 4.9 * fps], [90, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        style={{
          position: "absolute",
          left: -96,
          top: -142,
          translate: interpolate(
            frame,
            [
              2.6 * fps,
              4.3 * fps,
              4.45 * fps,
              4.6 * fps,
              4.75 * fps,
              4.9 * fps,
              5.2 * fps,
            ],
            [
              "450px 486px",
              "616px 486px",
              "619.8px 485.2px",
              "623.1px 483.1px",
              "625.2px 479.8px",
              "626px 476px",
              "626px 473px",
            ],
            {
              easing: [
                Easing.bezier(0.4, 0, 1, 1),
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
              ],
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      />
      <AirportAircraft
        name="OpenAir 3 — left taxiway queue"
        flightId="OA-210"
        status="Ready for review"
        priority={false}
        airline="OpenAir"
        labelPosition="below"
        premountFor={fps}
        width={192}
        height={286}
        heading={interpolate(frame, [6.3 * fps, 6.9 * fps], [90, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        style={{
          position: "absolute",
          left: -96,
          top: -142,
          translate: interpolate(
            frame,
            [
              4.6 * fps,
              6.3 * fps,
              6.45 * fps,
              6.6 * fps,
              6.75 * fps,
              6.9 * fps,
              7.2 * fps,
            ],
            [
              "104px 486px",
              "196px 486px",
              "199.8px 485.2px",
              "203.1px 483.1px",
              "205.2px 479.8px",
              "206px 476px",
              "206px 473px",
            ],
            {
              easing: [
                Easing.bezier(0.4, 0, 1, 1),
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
                Easing.linear,
              ],
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
        }}
      />
      <AirportControlPanel name="Control tower UI" premountFor={fps} />
    </>
  );
};

export const PixelAirport = Interactive.withSchema({
  Component: PixelAirportContent,
  componentName: "PixelAirport",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
