// Phaser path and canvas rendering for the shared airfield geometry.
import Phaser from "phaser";
import { ENTRIES, H, NORTH_Y, STANDS, W } from "./airfieldLayout";
export * from "./airfieldLayout";

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

/** The hold bar of an entry: across the road at its hold mark. pathLength makes every bar five whole dashes. */
const HOLD_BARS = ENTRIES.map(({ hold, heading }) => {
  const a = (heading * Math.PI) / 180;
  const dx = Math.cos(a) * 18, dy = Math.sin(a) * 18;
  return `<path d="M ${(hold.x - dx).toFixed(1)} ${(hold.y - dy).toFixed(1)} L ${(hold.x + dx).toFixed(1)} ${(hold.y + dy).toFixed(1)}" pathLength="32" fill="none" stroke="#f2cc69" stroke-width="6" stroke-dasharray="4 3"/>`;
}).join("");

// The runway centerline ends on a whole dash: 105 + 18 × (29 + 27) + 29 = 1142.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
<path d="${ROADS}" fill="none" stroke="#3c5146" stroke-width="58" stroke-linejoin="round"/>
${APRON}
<path d="${ROADS}" fill="none" stroke="#68766e" stroke-width="48" stroke-linejoin="round"/>
<path d="M 20 336 H 1260 V 424 H 20 Z" fill="#37434a" stroke="#263b35" stroke-width="6"/>
<path d="M 24 342 H 1256 M 24 418 H 1256" fill="none" stroke="#8c9992" stroke-width="2"/>
<path d="M 105 380 H 1142" fill="none" stroke="#f2f0df" stroke-width="5" stroke-dasharray="29 27"/>
<path d="M 34 346 V 414 M 48 346 V 414 M 62 346 V 414 M 76 346 V 414 M 1204 346 V 414 M 1218 346 V 414 M 1232 346 V 414 M 1246 346 V 414" fill="none" stroke="#f2f0df" stroke-width="7"/>
<path d="${ROADS}" fill="none" stroke="#e8c466" stroke-width="2"/>
${STAND_MARKS}
${CONCOURSE}
${HOLD_BARS}
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
