import "./index.css";
import { Composition, Folder } from "remotion";
import { PlaneSightPromo } from "./Composition";
import { PlaneSightLogo } from "./PlaneSightLogo";
import { CloudCodePlane, OpenAirPlane, PixelAirlines } from "./PixelAirlines";
import { PixelAirport } from "./PixelAirport";
import { AirportAircraft } from "./AirportAircraft";
import { AirportControlPanel } from "./AirportControlPanel";
import { AirportLayout } from "./AirportLayout";
import { EightAgentsIntro } from "./EightAgentsIntro";
import { PresenterNarration } from "./PresenterNarration";
import { FlightCrewScene } from "./FlightCrewScene";
import { AgentAirportSign } from "./AgentAirportSign";
import { AirportDemo, AirportOverview, FiveAgentsIntro } from "./FiveAgentDemo";
import { GeminiTowerScene } from "./GeminiTowerScene";
import { TaxiwayDependencies } from "./TaxiwayDependencies";
import { AirportSignZoom } from "./AirportSignZoom";
import { HerdrGroundControl } from "./HerdrGroundControl";
import { TowerZoom } from "./TowerZoom";
import { EntireTrailsOverlay } from "./EntireTrailsOverlay";
import { FrontOfLineZoom } from "./FrontOfLineZoom";
import { EntireCommitsBroll } from "./EntireCommitsBroll";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PlaneSightPromo"
        component={PlaneSightPromo}
        durationInFrames={2931}
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
      <Composition
        id="FiveAgentsIntro"
        component={FiveAgentsIntro}
        durationInFrames={243}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="AirportDemo"
        component={AirportDemo}
        durationInFrames={496}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="AirportOverview"
        component={AirportOverview}
        durationInFrames={1200}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="TaxiwayDependencies"
        component={TaxiwayDependencies}
        durationInFrames={176}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="AirportSignZoom"
        component={AirportSignZoom}
        durationInFrames={220}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="GeminiTowerScene"
        component={GeminiTowerScene}
        durationInFrames={374}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="HerdrGroundControl"
        component={HerdrGroundControl}
        durationInFrames={252}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="TowerZoom"
        component={TowerZoom}
        durationInFrames={62}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{ afterHerdr: false }}
      />
      <Composition
        id="EntireTrailsOverlay"
        component={EntireTrailsOverlay}
        durationInFrames={45}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="FrontOfLineZoom"
        component={FrontOfLineZoom}
        durationInFrames={91}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="EntireCommitsBroll"
        component={EntireCommitsBroll}
        durationInFrames={169}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="EightAgentsIntro"
        component={EightAgentsIntro}
        durationInFrames={243}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="AgentAirportSign"
        component={AgentAirportSign}
        durationInFrames={120}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="PresenterNarration"
        component={PresenterNarration}
        durationInFrames={2755}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="FlightCrewScene"
        component={FlightCrewScene}
        durationInFrames={297}
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
