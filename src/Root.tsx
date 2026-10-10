import "./index.css";
import { Composition, Folder } from "remotion";
import { PlaneSightPromo } from "./Composition";
import { PlaneSightLogo } from "./PlaneSightLogo";
import { CloudCodePlane, OpenAirPlane, PixelAirlines } from "./PixelAirlines";
import { PixelAirport } from "./PixelAirport";
import { AirportAircraft } from "./AirportAircraft";
import { AirportControlPanel } from "./AirportControlPanel";
import { AirportLayout } from "./AirportLayout";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PlaneSightPromo"
        component={PlaneSightPromo}
        durationInFrames={2655}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="PlaneSightLogo"
        component={PlaneSightLogo}
        durationInFrames={120}
        fps={30}
        width={1280}
        height={720}
      />
      <Folder name="Pixel-Airlines">
        <Composition
          id="AirportControlPanel"
          component={AirportControlPanel}
          durationInFrames={420}
          fps={30}
          width={1280}
          height={720}
        />
        <Composition
          id="AirportAircraft"
          component={AirportAircraft}
          durationInFrames={120}
          fps={30}
          width={192}
          height={332}
          defaultProps={{
            airline: "Cloud Code",
            airframe: "narrowbody",
            heading: 90,
            labelPosition: "above",
            status: "Build failed · urgent",
            priority: true,
            altitude: 0,
          }}
        />
        <Composition
          id="PixelAirport"
          component={PixelAirport}
          durationInFrames={1980}
          fps={30}
          width={1280}
          height={720}
        />
        <Composition
          id="AirportLayout"
          component={AirportLayout}
          durationInFrames={1980}
          fps={30}
          width={1280}
          height={720}
        />
        <Composition
          id="PixelAirlines"
          component={PixelAirlines}
          durationInFrames={180}
          fps={30}
          width={1280}
          height={720}
        />
        <Composition
          id="CloudCodePlane"
          component={CloudCodePlane}
          durationInFrames={180}
          fps={30}
          width={1280}
          height={720}
          defaultProps={{ airframe: "narrowbody" }}
        />
        <Composition
          id="OpenAirPlane"
          component={OpenAirPlane}
          durationInFrames={180}
          fps={30}
          width={1280}
          height={720}
          defaultProps={{ airframe: "narrowbody" }}
        />
        <Composition
          id="CloudCodeWidebody"
          component={CloudCodePlane}
          durationInFrames={180}
          fps={30}
          width={1280}
          height={720}
          defaultProps={{ airframe: "widebody" }}
        />
        <Composition
          id="OpenAirWidebody"
          component={OpenAirPlane}
          durationInFrames={180}
          fps={30}
          width={1280}
          height={720}
          defaultProps={{ airframe: "widebody" }}
        />
      </Folder>
    </>
  );
};
