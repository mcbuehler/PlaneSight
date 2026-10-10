import { AbsoluteFill, Series, useVideoConfig } from "remotion";
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
      <Series name="Promo scenes" layout="absolute-fill" premountFor={fps}>
        <Series.Sequence
          name="Narration — through crucial"
          trimBefore={(100 / 30) * fps}
          durationInFrames={28 * fps}
          premountFor={fps}
        >
          <PresenterNarration premountFor={fps} />
        </Series.Sequence>
        <Series.Sequence
          name="Meet the flight crew"
          trimBefore={0.7 * fps}
          durationInFrames={9.2 * fps}
          premountFor={fps}
        >
          <FlightCrewScene premountFor={fps} />
        </Series.Sequence>
        <Series.Sequence
          name="Narration — after flight crew"
          trimBefore={(940 / 30) * fps}
          durationInFrames={60.5 * fps}
          premountFor={fps}
        >
          <PresenterNarration premountFor={fps} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
