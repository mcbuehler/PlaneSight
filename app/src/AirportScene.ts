// The airfield in Phaser: terrain, roads, planes, their motion and the takeoff.
// main.ts owns the data; the HTML layer (ui.ts) draws only the bubble on top.
import Phaser from "phaser";
import terrainUrl from "../../public/airport/airport-terrain-v2.png?url";
import ccNarrowUrl from "../../public/airlines/cloud-code-narrowbody-orange.png?url";
import ccWideUrl from "../../public/airlines/cloud-code-widebody-orange.png?url";
import oaNarrowUrl from "../../public/airlines/openair-plane-top-down.png?url";
import oaWideUrl from "../../public/airlines/openair-widebody.png?url";
import { ENTRIES, H, NORTH_Y, RUNWAY_Y, SOUTH_Y, W, pathFromSvg, type Entry } from "./airfield";
import type { Airframe, Airline, Spot, Tone } from "./types";

const SPRITES: Record<string, string> = {
  "cloud-code-narrowbody": ccNarrowUrl,
  "cloud-code-widebody": ccWideUrl,
  "openair-narrowbody": oaNarrowUrl,
  "openair-widebody": oaWideUrl,
};
/** Plane size on the grid at scale 1; widebodies are drawn larger, as in the promo. */
export const PLANE_SIZE: Record<Airframe, number> = { narrowbody: 84, widebody: 104 };
/** Screen pixels per grid unit: the stage's CSS scale times the display's pixel ratio. */
export function screenResolution() {
  return Math.max(1, Math.min(window.innerWidth / W, window.innerHeight / H) * (window.devicePixelRatio || 1));
}
// The canvas renders at exactly the screen's resolution, so nothing is stretched after drawing.
// Plane textures are drawn once at the next whole multiple and only ever shrink slightly.
let RES = screenResolution();
const TEX_RES = Math.ceil(RES);
const PAD = 5;
const TONE_COLOR: Record<Tone, string> = {
  approve: "#d9534a",
  decide: "#3f7fd0",
  review: "#3f9a4f",
  alert: "#e0a020",
  parked: "#9aa1aa",
  flying: "#ffffff",
};

/** What a plane's flight strip says. */
export interface StripView {
  rank: number;
  name: string;
  status: string;
  /** #1 in the queue: amber paper. */
  next: boolean;
  alert: boolean;
  selected: boolean;
}

export interface PlaneView {
  session: string;
  airline: Airline;
  airframe: Airframe;
  tone: Tone;
  spot: Spot;
  /** null for planes without a strip (at a stand or in flight). */
  strip: StripView | null;
}

export interface AirportCallbacks {
  onSelect: (session: string) => void;
  onGround: (x: number, y: number) => void;
}

// The flight strips follow the promo's AirportAircraft tooltip: cream paper, a thick left edge,
// Courier type, the airline's colour, amber for the next plane.
const STRIP_W = 180;
const STRIP_H = 51;
/** Top-left corner of the strip relative to its plane, per placement (see Spot.tag). */
const STRIP_AT = { left: { x: -232, y: -30 }, above: { x: -90, y: -88 }, below: { x: -90, y: 38 } } as const;
const STRIP_FONT = '"Courier New", ui-monospace, monospace';
const INK = {
  paper: 0xf7f5e9,
  paperNext: 0xfff0c9,
  edge: 0x324e41,
  edgeNext: 0x9a692c,
  selected: 0xffffff,
  shadow: 0x334d41,
  rank: "#526557",
  status: "#526557",
  statusNext: "#86591c",
  statusAlert: "#a5630a",
  airline: { "cloud-code": "#a3410e", openair: "#105734" } as Record<Airline, string>,
};

type StripObject = Phaser.GameObjects.Container & {
  edge: Phaser.GameObjects.Rectangle;
  paper: Phaser.GameObjects.Rectangle;
  rank: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  /** The content it shows now; it is redrawn only when this changes. */
  sig: string;
  at: { x: number; y: number };
  shown: boolean;
};

type PlaneObject = Phaser.GameObjects.Container & {
  session: string;
  sprite: string;
  body: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Image;
  outline: Phaser.GameObjects.Image;
  art: Phaser.GameObjects.Image;
  spot?: Spot;
  orbit?: { cx: number; cy: number; rx: number; ry: number; phase: number; speed: number } | null;
  pulse?: Phaser.Tweens.Tween | null;
  /** The running taxi or takeoff; a new one stops it, so two never fight over the position. */
  move?: Phaser.Tweens.Tween | null;
  departing?: boolean;
  strip?: StripObject;
};

const entryById = (id?: string) => ENTRIES.find((e) => e.id === id);

export class AirportScene extends Phaser.Scene {
  private planes = new Map<string, PlaneObject>();
  private views: PlaneView[] = [];
  private selected: string | null = null;
  private ready = false;
  private bracket!: Phaser.GameObjects.Graphics;

  constructor(private callbacks: AirportCallbacks, private roads: HTMLCanvasElement) {
    super("airport");
  }

  preload() {
    this.load.image("terrain", terrainUrl);
    for (const [key, url] of Object.entries(SPRITES)) this.load.image(`src-${key}`, url);
  }

  create() {
    this.cameras.main.setZoom(RES).centerOn(W / 2, H / 2);
    // keep the terrain's pixel blocks hard when it is enlarged
    this.textures.get("terrain").setFilter(Phaser.Textures.FilterMode.NEAREST);
    // the terrain is 16:9 like the grid; cover it exactly, as the promo does
    this.add.image(W / 2, H / 2, "terrain").setDisplaySize(W, H);
    this.textures.addCanvas("roads", this.roads);
    this.add.image(0, 0, "roads").setOrigin(0, 0).setDisplaySize(W, H);
    for (const key of Object.keys(SPRITES)) this.makeTextures(key);
    this.makePuff();
    this.bracket = this.add.graphics().setDepth(40);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.length) this.callbacks.onGround(pointer.worldX, pointer.worldY);
    });
    this.ready = true;
    this.apply(this.views, this.selected);
  }

  /** Per sprite: the plane at its size, a black shadow, and one outline per status colour. */
  private makeTextures(key: string) {
    const source = this.textures.get(`src-${key}`).getSourceImage() as HTMLImageElement;
    const size = PLANE_SIZE[key.endsWith("widebody") ? "widebody" : "narrowbody"] * TEX_RES;
    const tex = size + PAD * 2 * TEX_RES;
    const canvas = () => {
      const c = document.createElement("canvas");
      c.width = c.height = tex;
      return c;
    };
    const plane = canvas();
    const ctx = plane.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, PAD * TEX_RES, PAD * TEX_RES, size, size);
    this.textures.addCanvas(`plane-${key}`, plane);

    const silhouette = (color: string, spread: number) => {
      const c = canvas();
      const s = c.getContext("2d")!;
      if (spread === 0) s.drawImage(plane, 0, 0);
      else for (let dx = -spread; dx <= spread; dx += spread) for (let dy = -spread; dy <= spread; dy += spread) s.drawImage(plane, dx, dy);
      s.globalCompositeOperation = "source-in";
      s.fillStyle = color;
      s.fillRect(0, 0, tex, tex);
      return c;
    };
    this.textures.addCanvas(`shadow-${key}`, silhouette("#000", 0));
    for (const [tone, color] of Object.entries(TONE_COLOR)) this.textures.addCanvas(`outline-${key}-${tone}`, silhouette(color, 3 * TEX_RES));
  }

  private makePuff() {
    const c = document.createElement("canvas");
    c.width = c.height = 6;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 6, 6);
    this.textures.addCanvas("puff", c);
  }

  update(_time: number, delta: number) {
    for (const plane of this.planes.values()) {
      const o = plane.orbit;
      // planes in flight circle slowly, unless you are looking at one
      if (o && !plane.departing && plane.session !== this.selected) {
        o.phase += (delta / 1000) * o.speed;
        plane.setPosition(o.cx + o.rx * Math.cos(o.phase), o.cy + o.ry * Math.sin(o.phase));
        plane.body.rotation = Math.atan2(o.ry * Math.cos(o.phase), -o.rx * Math.sin(o.phase)) + Math.PI / 2;
      }
      const strip = plane.strip;
      if (strip) {
        strip.setPosition(plane.x + strip.at.x, plane.y + strip.at.y);
        // fade in and out over 200 ms, as the plane arrives or leaves
        const target = strip.shown && !plane.departing && plane.alpha > 0.5 ? 1 : 0;
        strip.alpha = Phaser.Math.Clamp(strip.alpha + Math.sign(target - strip.alpha) * (delta / 200), 0, 1);
      }
    }
    this.drawBracket();
  }

  private makePlane(view: PlaneView): PlaneObject {
    const key = `${view.airline}-${view.airframe}`;
    const scale = 1 / TEX_RES;
    const shadow = this.add.image(5, 5, `shadow-${key}`).setAlpha(0.22).setScale(scale);
    const outline = this.add.image(0, 0, `outline-${key}-${view.tone}`).setVisible(false).setScale(scale);
    const art = this.add.image(0, 0, `plane-${key}`).setScale(scale);
    const body = this.add.container(0, 0, [shadow, outline, art]);
    const plane = this.add.container(0, 0, [body]) as PlaneObject;
    Object.assign(plane, { session: view.session, sprite: key, body, shadow, outline, art });
    const hit = PLANE_SIZE[view.airframe] * 0.7;
    plane.setSize(hit, hit).setInteractive({ useHandCursor: true });
    plane.on("pointerdown", () => this.callbacks.onSelect(view.session));
    return plane;
  }

  private makeStrip(session: string): StripObject {
    const text = (size: number, bold: boolean) =>
      this.add.text(0, 0, "", { fontFamily: STRIP_FONT, fontSize: `${size}px`, fontStyle: bold ? "bold" : "normal", resolution: TEX_RES });
    const shadow = this.add.rectangle(3, 3, STRIP_W, STRIP_H, INK.shadow, 0.2).setOrigin(0, 0);
    const edge = this.add.rectangle(0, 0, STRIP_W, STRIP_H, INK.edge).setOrigin(0, 0);
    const paper = this.add.rectangle(6, 2, STRIP_W - 8, STRIP_H - 4, INK.paper).setOrigin(0, 0);
    const rank = text(13, true).setPosition(16, 9).setColor(INK.rank);
    const name = text(15, true).setPosition(0, 7);
    const status = text(11, false).setPosition(16, 31);
    const strip = this.add.container(0, 0, [shadow, edge, paper, rank, name, status]) as StripObject;
    Object.assign(strip, { edge, paper, rank, name, status, sig: "", at: STRIP_AT.left, shown: false });
    strip.setDepth(35).setAlpha(0);
    // a click on the strip selects its plane
    edge.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.onSelect(session));
    return strip;
  }

  private drawStrip(strip: StripObject, view: PlaneView) {
    const s = view.strip!;
    const sig = JSON.stringify([s, view.airline]);
    if (sig === strip.sig) return;
    strip.sig = sig;
    strip.edge.setFillStyle(s.selected ? INK.selected : s.next ? INK.edgeNext : INK.edge);
    strip.paper.setFillStyle(s.next ? INK.paperNext : INK.paper);
    strip.rank.setText(String(s.rank));
    strip.name.setColor(INK.airline[view.airline]).setX(strip.rank.x + strip.rank.width + 8);
    fit(strip.name, s.name, STRIP_W - 12 - strip.name.x);
    strip.status
      .setColor(s.alert ? INK.statusAlert : s.next ? INK.statusNext : INK.status)
      .setFontStyle(s.alert ? "bold" : "normal");
    fit(strip.status, s.status, STRIP_W - 12 - strip.status.x);
  }

  apply(views: PlaneView[], selected: string | null) {
    this.views = views;
    this.selected = selected;
    if (!this.ready) return;
    const seen = new Set<string>();

    for (const view of views) {
      seen.add(view.session);
      let plane = this.planes.get(view.session);
      if (plane?.departing) continue;
      const spot = view.spot;
      const isNew = !plane;
      if (!plane) {
        plane = this.makePlane(view);
        this.planes.set(view.session, plane);
        // a new plane in the queue taxis in from the west end of its taxiway; others fade in in place
        const entry = entryById(spot.entry);
        if (spot.kind === "queue" && entry) plane.setPosition(-70, entry.taxiY);
        else plane.setPosition(spot.x, spot.y).setAlpha(0);
        plane.body.setAngle(spot.kind === "queue" ? 90 : spot.heading).setScale(spot.scale);
      }

      const key = `${view.airline}-${view.airframe}`;
      if (plane.sprite !== key) {
        plane.sprite = key;
        plane.art.setTexture(`plane-${key}`);
        plane.shadow.setTexture(`shadow-${key}`);
      }
      plane.setDepth(spot.kind === "flying" ? 30 : spot.kind === "queue" ? 20 - (spot.rank ?? 0) * 0.01 : 10);
      plane.outline.setTexture(`outline-${key}-${view.tone}`).setVisible(spot.kind === "queue");
      const lift = spot.kind === "flying" ? 26 : 5;
      plane.shadow.setPosition(lift, lift);
      this.setPulse(plane, spot.kind === "queue" && spot.rank === 0);

      if (spot.kind === "flying") {
        if (!plane.orbit) {
          this.stopMoving(plane);
          plane.orbit = { cx: spot.x, cy: spot.y, rx: 44, ry: 12, phase: Math.random() * Math.PI * 2, speed: 0.3 + Math.random() * 0.15 };
          this.tweens.add({ targets: plane, alpha: 0.92, duration: 600 });
          this.tweens.add({ targets: plane.body, scale: spot.scale, duration: 600 });
        } else {
          plane.orbit.cx = spot.x;
          plane.orbit.cy = spot.y;
        }
      } else {
        plane.orbit = null;
        if (isNew || plane.spot?.x !== spot.x || plane.spot?.y !== spot.y) this.moveTo(plane, spot);
      }
      plane.spot = spot;

      if (view.strip && spot.tag !== "none") {
        plane.strip ??= this.makeStrip(view.session);
        plane.strip.at = STRIP_AT[spot.tag];
        plane.strip.shown = true;
        this.drawStrip(plane.strip, view);
      } else if (plane.strip) {
        plane.strip.shown = false;
      }
    }

    for (const [session, plane] of this.planes) {
      if (seen.has(session) || plane.departing) continue;
      this.planes.delete(session);
      this.stopMoving(plane);
      if (plane.strip) plane.strip.shown = false;
      this.tweens.add({ targets: plane, alpha: 0, duration: 400, onComplete: () => { plane.strip?.destroy(); plane.destroy(); } });
    }
  }

  private stopMoving(plane: PlaneObject) {
    plane.move?.stop();
    plane.move = null;
    this.tweens.killTweensOf([plane, plane.body]);
  }

  /** The route to a spot: along the plane's taxiway and down its entry when it can, else straight there. */
  private route(plane: PlaneObject, spot: Spot) {
    const entry = entryById(spot.entry);
    const onItsTaxiway = entry && Math.abs(plane.y - entry.taxiY) < 6 && plane.x <= (spot.x === entry.hold.x ? entry.startX : spot.x) + 4;
    if (spot.kind === "queue" && entry && onItsTaxiway) {
      const path = new Phaser.Curves.Path(plane.x, plane.y);
      if (spot.x === entry.hold.x && spot.y === entry.hold.y) {
        path.lineTo(entry.startX, entry.taxiY);
        append(path, pathFromSvg(entry.d, entry.hold));
      } else {
        path.lineTo(spot.x, spot.y);
      }
      return { path, steer: true };
    }
    return { path: new Phaser.Curves.Path(plane.x, plane.y).lineTo(spot.x, spot.y), steer: false };
  }

  /**
   * The way over the taxiways to or from a stand. A plane at a stand is pushed back onto the
   * north taxiway first; a plane at a hold mark turns back up its entry. Crossings over the
   * runway are straight. Null when the plane is not on the ground.
   */
  private groundRoute(plane: PlaneObject, spot: Spot) {
    const from = plane.spot;
    const path = new Phaser.Curves.Path(plane.x, plane.y);
    let pushback = 0;
    let taxiY: number;
    const fromEntry = entryById(from?.entry);
    if (from?.kind === "parked" && near(plane, from)) {
      lineTo(path, plane.x, NORTH_Y);
      pushback = path.getLength();
      taxiY = NORTH_Y;
    } else if (from?.kind === "queue" && fromEntry && near(plane, fromEntry.hold)) {
      const toTaxiY = spot.kind === "parked" ? NORTH_Y : entryById(spot.entry)?.taxiY ?? fromEntry.taxiY;
      if (toTaxiY !== fromEntry.taxiY) {
        // over the runway: on down this entry, then up its partner on the other side
        addPoints(path, restOfEntry(fromEntry).getSpacedPoints(12));
        addPoints(path, pathFromSvg(entryById(PARTNER[fromEntry.id])!.d).getSpacedPoints(24).reverse());
        taxiY = toTaxiY;
      } else {
        // turn back up the entry onto its taxiway
        addPoints(path, pathFromSvg(fromEntry.d, fromEntry.hold).getSpacedPoints(24).reverse());
        taxiY = fromEntry.taxiY;
      }
    } else if (Math.abs(plane.y - NORTH_Y) < 6 || Math.abs(plane.y - SOUTH_Y) < 6) {
      taxiY = Math.abs(plane.y - NORTH_Y) < 6 ? NORTH_Y : SOUTH_Y;
    } else {
      return null;
    }

    const toEntry = entryById(spot.entry);
    const targetY = spot.kind === "parked" ? NORTH_Y : toEntry?.taxiY ?? taxiY;
    if (targetY !== taxiY) crossRunway(path, taxiY);
    if (spot.kind === "parked") {
      lineTo(path, spot.x, NORTH_Y);
      lineTo(path, spot.x, spot.y);
    } else if (toEntry && near(spot, toEntry.hold)) {
      lineTo(path, toEntry.startX, toEntry.taxiY);
      append(path, pathFromSvg(toEntry.d, toEntry.hold));
    } else {
      lineTo(path, spot.x, targetY);
    }
    return { path, pushback: pushback / Math.max(path.getLength(), 1) };
  }

  /** From the sky straight to a stand: the plane fades out where it circles and in at its stand. */
  private arriveAtStand(plane: PlaneObject, spot: Spot) {
    plane.move = this.tweens.add({
      targets: plane,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        plane.setPosition(spot.x, spot.y);
        plane.body.setAngle(spot.heading).setScale(spot.scale);
        plane.shadow.setPosition(5, 5);
        plane.move = this.tweens.add({ targets: plane, alpha: 1, duration: 400 });
      },
    });
  }

  private moveTo(plane: PlaneObject, spot: Spot) {
    this.stopMoving(plane);
    const toOrFromStand = spot.kind === "parked" || plane.spot?.kind === "parked";
    const ground = toOrFromStand && plane.alpha > 0 ? this.groundRoute(plane, spot) : null;
    if (toOrFromStand && !ground && plane.alpha > 0) return this.arriveAtStand(plane, spot);
    const { path, steer } = ground ? { path: ground.path, steer: true } : this.route(plane, spot);
    const pushback = ground?.pushback ?? 0;
    const length = path.getLength();
    if (length < 1) {
      this.tweens.add({ targets: plane, alpha: 1, duration: 400 });
      this.tweens.add({ targets: plane.body, angle: spot.heading, scale: spot.scale, duration: 400 });
      return;
    }
    const startScale = plane.body.scale;
    const startAngle = plane.body.angle;
    const turn = Phaser.Math.Angle.ShortestBetween(startAngle, spot.heading);
    plane.move = this.tweens.addCounter({
      from: 0,
      to: 1,
      // taxiing to or from a stand is slower than a shuffle in the queue
      duration: ground ? Phaser.Math.Clamp(length * 6, 1800, 5200) : Phaser.Math.Clamp(length * 3.2, 500, 3200),
      ease: "Sine.easeInOut",
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const point = path.getPoint(t);
        plane.setPosition(point.x, point.y);
        plane.setAlpha(Math.max(plane.alpha, Math.min(1, t * 3)));
        plane.body.setScale(startScale + (spot.scale - startScale) * t);
        if (steer) {
          const tangent = path.getTangent(Math.min(t, 0.995));
          // pushed back, the plane moves tail first
          turnTowards(plane.body, Math.atan2(tangent.y, tangent.x) + Math.PI / 2 + (t < pushback ? Math.PI : 0));
        } else {
          plane.body.setAngle(startAngle + turn * Math.min(1, t * 1.5));
        }
      },
      onComplete: () => {
        plane.move = null;
        plane.setAlpha(1);
        this.tweens.add({ targets: plane.body, angle: plane.body.angle + Phaser.Math.Angle.ShortestBetween(plane.body.angle, spot.heading), duration: 250 });
      },
    });
  }

  private setPulse(plane: PlaneObject, on: boolean) {
    if (on && !plane.pulse) {
      plane.pulse = this.tweens.add({ targets: plane.outline, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    } else if (!on && plane.pulse) {
      plane.pulse.stop();
      plane.pulse = null;
      plane.outline.setAlpha(1);
    }
  }

  private drawBracket() {
    this.bracket.clear();
    const plane = this.selected ? this.planes.get(this.selected) : null;
    if (!plane || plane.departing) return;
    const size = PLANE_SIZE[plane.sprite.endsWith("widebody") ? "widebody" : "narrowbody"];
    const r = (size / 2) * plane.body.scale * 0.85;
    this.bracket.lineStyle(3, 0xffffff, 0.95);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = plane.x + dx * r;
      const y = plane.y + dy * r;
      this.bracket.lineBetween(x, y, x - dx * 12, y);
      this.bracket.lineBetween(x, y, x, y - dy * 12);
    }
  }

  positionOf(session: string) {
    const plane = this.planes.get(session);
    return plane ? { x: plane.x, y: plane.y } : null;
  }

  /** The way to the runway from where the plane is, then the roll east and the climb out. */
  private departure(plane: PlaneObject) {
    const entry = entryById(plane.spot?.entry);
    const path = new Phaser.Curves.Path(plane.x, plane.y);
    let pushback = 0;
    if (entry && plane.spot?.kind === "queue") {
      const atHold = Math.abs(plane.x - entry.hold.x) < 4 && Math.abs(plane.y - entry.hold.y) < 4;
      if (atHold) append(path, restOfEntry(entry));
      else {
        path.lineTo(entry.startX, entry.taxiY);
        append(path, pathFromSvg(entry.d));
      }
    } else if (plane.spot?.kind === "parked") {
      // push back onto the north taxiway, then taxi east to the next entry
      lineTo(path, plane.x, NORTH_Y);
      pushback = path.getLength();
      const north = ENTRIES.filter((e) => e.taxiY === NORTH_Y);
      const next = north.find((e) => e.startX >= plane.x - 1) ?? north[north.length - 1];
      lineTo(path, next.startX, NORTH_Y);
      append(path, pathFromSvg(next.d));
    } else {
      // from anywhere else: straight onto the runway
      path.lineTo(Math.max(plane.x, 120), RUNWAY_Y);
    }
    const rollFrom = path.getLength();
    path.lineTo(1235, RUNWAY_Y);
    path.lineTo(1380, RUNWAY_Y - 60);
    const total = path.getLength();
    return { path, rollStart: rollFrom / total, pushback: pushback / total };
  }

  /** The big moment: down the entry, onto the runway, roll with exhaust, lift off the east edge. */
  takeoff(session: string, done: () => void) {
    const plane = this.planes.get(session);
    if (!plane || plane.departing) return done();
    plane.departing = true;
    plane.orbit = null;
    this.setPulse(plane, false);
    this.stopMoving(plane);
    plane.outline.setVisible(false);
    plane.disableInteractive();

    const { path, rollStart, pushback } = this.departure(plane);
    const exhaust = this.add.particles(0, 0, "puff", {
      speed: { min: 6, max: 22 },
      lifespan: 650,
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.55, end: 0 },
      frequency: 22,
      emitting: false,
    }).setDepth(plane.depth - 1);
    exhaust.startFollow(plane);

    const startScale = plane.body.scale;
    plane.move = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 2200 + path.getLength() * 1.2,
      ease: "Quad.easeIn",
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const point = path.getPoint(t);
        const tangent = path.getTangent(Math.min(t, 0.995));
        plane.setPosition(point.x, point.y);
        turnTowards(plane.body, Math.atan2(tangent.y, tangent.x) + Math.PI / 2 + (t < pushback ? Math.PI : 0));
        if (t > rollStart && !exhaust.emitting) exhaust.start();
        const lift = Phaser.Math.Clamp((t - 0.88) / 0.12, 0, 1);
        plane.body.setScale(startScale + 0.4 * lift);
        plane.shadow.setPosition(5 + 34 * lift, 5 + 42 * lift);
      },
      onComplete: () => {
        exhaust.stop();
        this.time.delayedCall(900, () => exhaust.destroy());
        this.planes.delete(session);
        plane.strip?.destroy();
        plane.destroy();
        done();
      },
    });
  }
}

/** Turns a plane part of the way to a heading each frame, so corners are rounded, not snapped. */
function turnTowards(body: Phaser.GameObjects.Container, rotation: number) {
  body.rotation += Phaser.Math.Angle.Wrap(rotation - body.rotation) * 0.2;
}

/** The entries on the two sides that meet on the runway. */
const PARTNER: Record<string, string> = { nw: "sw", sw: "nw", nc: "sc", sc: "nc", ne: "se", se: "ne" };

/** From one taxiway to the other: down the nearest entry onto the runway and up its partner. */
function crossRunway(path: Phaser.Curves.Path, taxiY: number) {
  const x = path.getEndPoint().x;
  const entry = ENTRIES.filter((e) => e.taxiY === taxiY).reduce((a, b) => (Math.abs(b.startX - x) < Math.abs(a.startX - x) ? b : a));
  lineTo(path, entry.startX, taxiY);
  addPoints(path, pathFromSvg(entry.d).getSpacedPoints(24));
  addPoints(path, pathFromSvg(entryById(PARTNER[entry.id])!.d).getSpacedPoints(24).reverse());
}

function addPoints(path: Phaser.Curves.Path, points: { x: number; y: number }[]) {
  for (const p of points) lineTo(path, p.x, p.y);
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < 4 && Math.abs(a.y - b.y) < 4;

/** A straight line to a point, left out when the path is already there. */
function lineTo(path: Phaser.Curves.Path, x: number, y: number) {
  const end = path.getEndPoint();
  if (Math.hypot(end.x - x, end.y - y) > 0.5) path.lineTo(x, y);
}

/** Sets the text, cut with an ellipsis so it fits the width. */
function fit(text: Phaser.GameObjects.Text, value: string, width: number) {
  text.setText(value);
  for (let n = value.length - 1; text.width > width && n > 1; n--) text.setText(value.slice(0, n) + "…");
}

/** Appends the curves of one path to another; Phaser's add() takes single curves only. */
function append(path: Phaser.Curves.Path, more: Phaser.Curves.Path) {
  for (const curve of more.curves) path.add(curve);
}

/** From the hold mark to the end of the entry, where it meets the runway. */
function restOfEntry(entry: Entry) {
  const m = entry.d.match(/L (\d+) (\d+) Q (\d+) (\d+) (\d+) (\d+)$/);
  const path = new Phaser.Curves.Path(entry.hold.x, entry.hold.y);
  if (!m) return path.lineTo(entry.hold.x + 60, RUNWAY_Y);
  const [lx, ly, cx, cy, ex, ey] = m.slice(1).map(Number);
  path.lineTo(lx, ly);
  path.quadraticBezierTo(ex, ey, cx, cy);
  return path;
}

export function createAirport(parent: HTMLElement, callbacks: AirportCallbacks, roads: HTMLCanvasElement) {
  const scene = new AirportScene(callbacks, roads);
  // The canvas has the screen's pixels and is shown at grid size (zoom 1 / RES), so it maps 1:1
  // onto the display; the camera zoom keeps the world in grid coordinates.
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: Math.round(W * RES),
    height: Math.round(H * RES),
    transparent: true,
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / RES },
    scene,
  });
  return {
    scene,
    /** After a window resize: render at the new screen resolution, then let Phaser re-read the canvas size. */
    refresh: () => {
      const next = screenResolution();
      if (Math.abs(next - RES) > 0.01 && game.isBooted) {
        RES = next;
        game.scale.resize(Math.round(W * RES), Math.round(H * RES));
        game.scale.setZoom(1 / RES);
        scene.cameras.main?.setZoom(RES).centerOn(W / 2, H / 2);
      }
      game.scale.refresh();
    },
  };
}
