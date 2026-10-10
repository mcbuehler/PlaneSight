import "./index.css";
import { Composition, Folder } from "remotion";
import { PlaneSightPromo } from "./Composition";
import { PlaneSightLogo } from "./PlaneSightLogo";
import { CloudCodePlane, OpenAirPlane, PixelAirlines } from "./PixelAirlines";
import { PixelAirport } from "./PixelAirport";

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
          id="PixelAirport"
          component={PixelAirport}
          durationInFrames={180}
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
        />
        <Composition
          id="OpenAirPlane"
          component={OpenAirPlane}
          durationInFrames={180}
          fps={30}
          width={1280}
          height={720}
        />
      </Folder>
    </>
  );
};
