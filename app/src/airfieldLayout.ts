// The airfield from the promo (promo/src/AirportLayout.tsx): a central runway, a north and a south taxiway,
// and six angled entries. Same 1280 x 720 grid and the same path data, so the app and the video match.
export const W = 1280;
export const H = 720;
export const RUNWAY_Y = 380;
export const NORTH_Y = 210;
export const SOUTH_Y = 550;

/** One angled entry from a taxiway onto the runway, with the hold mark where planes wait. */
export interface Entry {
  id: string;
  taxiY: number;
  startX: number;
  /** The path data, copied from AirportLayout.tsx. */
  d: string;
  hold: { x: number; y: number };
  /** Heading of a plane waiting at the hold mark: 0 up, 90 right. */
  heading: number;
}

// Each north entry meets its south partner at one point on the runway centerline.
export const ENTRIES: Entry[] = [
  { id: "nw", taxiY: NORTH_Y, startX: 250, d: "M 250 210 Q 262 210 271 219 L 414 362 Q 432 380 458 380", hold: { x: 363, y: 311 }, heading: 135 },
  { id: "sw", taxiY: SOUTH_Y, startX: 250, d: "M 250 550 Q 262 550 271 541 L 414 398 Q 432 380 458 380", hold: { x: 363, y: 449 }, heading: 45 },
  { id: "nc", taxiY: NORTH_Y, startX: 590, d: "M 590 210 Q 602 210 611 219 L 754 362 Q 772 380 798 380", hold: { x: 703, y: 311 }, heading: 135 },
  { id: "sc", taxiY: SOUTH_Y, startX: 590, d: "M 590 550 Q 602 550 611 541 L 754 398 Q 772 380 798 380", hold: { x: 703, y: 449 }, heading: 45 },
  { id: "ne", taxiY: NORTH_Y, startX: 1060, d: "M 1060 210 Q 1072 210 1081 229 L 1160 360 Q 1167 380 1178 380", hold: { x: 1127, y: 306 }, heading: 149 },
  { id: "se", taxiY: SOUTH_Y, startX: 970, d: "M 970 550 Q 982 550 991 541 L 1134 398 Q 1152 380 1178 380", hold: { x: 1083, y: 449 }, heading: 45 },
];

/** Taxiway places behind the entries, for agents beyond the sixth. Each belongs to one entry. */
export const BEHIND = [
  { entry: "nw", x: 130 }, { entry: "sw", x: 130 }, { entry: "nc", x: 470 }, { entry: "sc", x: 470 },
  { entry: "ne", x: 940 }, { entry: "se", x: 830 }, { entry: "nc", x: 350 }, { entry: "sc", x: 350 },
  { entry: "ne", x: 820 }, { entry: "se", x: 710 },
];

/** Stands at the concourse, west to east. A parked plane faces north, nose at the jet bridge. */
export const STAND_Y = 120;
export const PARKED_SCALE = 0.75;
export const STANDS = Array.from({ length: 11 }, (_, i) => ({ number: i + 1, x: 230 + i * 80, y: STAND_Y }));
