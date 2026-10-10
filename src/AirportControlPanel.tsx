import { Interactive } from "remotion";

const AirportControlPanelContent = () => {
  return <></>;
};

export const AirportControlPanel = Interactive.withSchema({
  Component: AirportControlPanelContent,
  componentName: "AirportControlPanel",
  schema: {},
  wrapInSequence: true,
  layout: "absolute-fill",
});
