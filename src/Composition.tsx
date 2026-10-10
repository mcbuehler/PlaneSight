import { AbsoluteFill, useVideoConfig } from "remotion";
import { EightAgentsIntro } from "./EightAgentsIntro";
import { PresenterNarration } from "./PresenterNarration";
import { FlightCrewScene } from "./FlightCrewScene";

export const PlaneSightPromo = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <EightAgentsIntro
        name="Opening — eight agents waiting"
        durationInFrames={8.1 * fps}
        premountFor={fps}
      />
      <PresenterNarration
        name="Narration — through crucial"
        trimBefore={(100 / 30) * fps}
        durationInFrames={28 * fps}
        premountFor={fps}
      />
      <FlightCrewScene
        name="Meet the flight crew"
        from={28 * fps}
        trimBefore={0.7 * fps}
        durationInFrames={9.2 * fps}
        premountFor={fps}
      />
      <PresenterNarration
        name="Narration — after flight crew"
        from={37.2 * fps}
        trimBefore={(940 / 30) * fps}
        durationInFrames={60.5 * fps}
        premountFor={fps}
      />
    </AbsoluteFill>
  );
};
