// The airfield from the promo (src/AirportLayout.tsx): a central runway, a north and a south taxiway,
// and six angled entries. Same 1280 x 720 grid and the same path data, so the app and the video match.
import Phaser from "phaser";

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

// The order is the order of the queue: #1 waits at the first entry, #2 at the second, and so on.
export const ENTRIES: Entry[] = [
  { id: "nw", taxiY: NORTH_Y, startX: 250, d: "M 250 210 Q 262 210 271 219 L 414 362 Q 432 380 458 380", hold: { x: 363, y: 311 }, heading: 135 },
  { id: "sw", taxiY: SOUTH_Y, startX: 250, d: "M 250 550 Q 262 550 271 541 L 414 398 Q 432 380 458 380", hold: { x: 363, y: 449 }, heading: 45 },
  { id: "nc", taxiY: NORTH_Y, startX: 590, d: "M 590 210 Q 602 210 611 219 L 754 362 Q 772 380 798 380", hold: { x: 703, y: 311 }, heading: 135 },
  { id: "sc", taxiY: SOUTH_Y, startX: 590, d: "M 590 550 Q 602 550 611 541 L 754 398 Q 772 380 798 380", hold: { x: 703, y: 449 }, heading: 45 },
  { id: "ne", taxiY: NORTH_Y, startX: 1060, d: "M 1060 210 Q 1072 210 1081 229 L 1160 360 Q 1167 380 1178 380", hold: { x: 1127, y: 306 }, heading: 149 },
  { id: "se", taxiY: SOUTH_Y, startX: 950, d: "M 950 550 Q 962 550 971 541 L 1114 398 Q 1132 380 1158 380", hold: { x: 1063, y: 449 }, heading: 45 },
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

/** Parses the M, L, H, V and Q commands that the layout uses into a Phaser path. */
export function pathFromSvg(d: string, upTo?: { x: number; y: number }) {
  const tokens = d.match(/[MLHVQ]|-?\d+(\.\d+)?/g) ?? [];
  let path: Phaser.Curves.Path | null = null;
  let x = 0;
  let y = 0;
  for (let i = 0; i < tokens.length; ) {
    const cmd = tokens[i++];
    const n = () => Number(tokens[i++]);
    if (cmd === "M") { x = n(); y = n(); path = new Phaser.Curves.Path(x, y); continue; }
    if (!path) throw new Error(`path data must start with M: ${d}`);
    if (cmd === "L") { x = n(); y = n(); }
    else if (cmd === "H") x = n();
    else if (cmd === "V") y = n();
    else if (cmd === "Q") {
      const cx = n(), cy = n();
      x = n(); y = n();
      path.quadraticBezierTo(x, y, cx, cy);
      continue;
    }
    // stop at a point on this straight segment (the hold mark), if asked
    if (upTo && isBetween(path.getEndPoint(), { x, y }, upTo)) {
      path.lineTo(upTo.x, upTo.y);
      return path;
    }
    path.lineTo(x, y);
  }
  return path!;
}

function isBetween(a: Phaser.Math.Vector2, b: { x: number; y: number }, p: { x: number; y: number }) {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const within = Math.min(a.x, b.x) - 1 <= p.x && p.x <= Math.max(a.x, b.x) + 1 && Math.min(a.y, b.y) - 1 <= p.y && p.y <= Math.max(a.y, b.y) + 1;
  return within && Math.abs(cross) < 600;
}

// ---------------------------------------------------------------- the road drawing

const ROADS = "M 38 210 H 1220 M 38 550 H 1220 " + ENTRIES.map((e) => e.d).join(" ");

// The apron north of the north taxiway, and a concourse that joins the terminal in the art.
// Colours follow the terminal sprite: grey roof with a light edge, a dark outline, blue glass.
const APRON = `<path d="M 165 62 H 1075 V 200 H 165 Z" fill="#76847b" stroke="#3c5146" stroke-width="5"/>
<rect x="160" y="64" width="913" height="6" fill="#000" opacity=".2"/>`;
const STAND_MARKS = STANDS.map(({ number, x }) => `
<path d="M ${x - 40} 76 V 182" stroke="#f2f0df" stroke-width="1.5" stroke-dasharray="4 4" opacity=".35"/>
<path d="M ${x} 210 V 96" stroke="#e8c466" stroke-width="2"/>
<path d="M ${x - 8} 92 H ${x + 8}" stroke="#f2cc69" stroke-width="3"/>
<text x="${x + 7}" y="178" font-family="Courier New, monospace" font-weight="700" font-size="12" fill="#f2f0df">${number}</text>`).join("");
const CONCOURSE = `<rect x="156" y="36" width="921" height="28" fill="#4a525a"/>
<rect x="158" y="38" width="917" height="24" fill="#c9cdd2"/>
<rect x="158" y="38" width="917" height="4" fill="#e4e7ea"/>
${STANDS.map(({ x }) => `<rect x="${x - 26}" y="49" width="52" height="8" fill="#2e6cc0"/><rect x="${x - 26}" y="49" width="52" height="3" fill="#7fb4ea"/>`).join("")}
${STANDS.map(({ x }) => `<rect x="${x - 15}" y="62" width="8" height="22" fill="#4a525a"/><rect x="${x - 14}" y="62" width="6" height="21" fill="#aeb3ba"/>
<rect x="${x - 17}" y="82" width="12" height="8" fill="#4a525a"/><rect x="${x - 16}" y="83" width="10" height="6" fill="#c9cdd2"/>`).join("")}`;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
<path d="${ROADS}" fill="none" stroke="#3c5146" stroke-width="58" stroke-linejoin="round"/>
${APRON}
<path d="${ROADS}" fill="none" stroke="#68766e" stroke-width="48" stroke-linejoin="round"/>
<path d="M 20 336 H 1260 V 424 H 20 Z" fill="#37434a" stroke="#263b35" stroke-width="6"/>
<path d="M 24 342 H 1256 M 24 418 H 1256" fill="none" stroke="#8c9992" stroke-width="2"/>
<path d="M 105 380 H 1175" fill="none" stroke="#f2f0df" stroke-width="5" stroke-dasharray="29 27"/>
<path d="M 34 346 V 414 M 48 346 V 414 M 62 346 V 414 M 76 346 V 414 M 1204 346 V 414 M 1218 346 V 414 M 1232 346 V 414 M 1246 346 V 414" fill="none" stroke="#f2f0df" stroke-width="7"/>
<path d="${ROADS}" fill="none" stroke="#e8c466" stroke-width="2"/>
${STAND_MARKS}
${CONCOURSE}
<path d="M 350 324 L 376 298 M 690 324 L 716 298 M 1110 319 L 1144 299 M 350 436 L 376 462 M 690 436 L 716 462 M 1050 436 L 1076 462" fill="none" stroke="#f2cc69" stroke-width="6" stroke-dasharray="4 3"/>
</svg>`;

/** The roads as a canvas, drawn at twice the grid size so they stay sharp on large screens. */
export async function drawRoads(scale = 2): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}
