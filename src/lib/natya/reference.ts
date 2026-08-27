import type { Adavu } from "./adavus";
import { L } from "./analysis";
import type { Pt } from "./types";

const rad = (d: number) => (d * Math.PI) / 180;

/** two-bone solve: given root & target, return the joint bent towards `sideSign` */
function ik(root: Pt, target: Pt, a: number, b: number, sideSign: number): Pt {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const d = Math.max(1e-4, Math.min(Math.hypot(dx, dy), a + b - 1e-4));
  const ux = dx / d;
  const uy = dy / d;
  const x = (d * d + a * a - b * b) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  return { x: root.x + ux * x + -uy * h * sideSign, y: root.y + uy * x + ux * h * sideSign };
}

/**
 * Build an idealised instructor skeleton (33 MediaPipe landmarks, normalised 0..1)
 * for an adavu at animation phase `phase` (0..1 over one beat cycle).
 */
export function referencePose(adavu: Adavu, phase: number): Pt[] {
  const p: Pt[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  const cx = 0.5;
  const shoulderW = 0.2;
  const hipW = 0.13;
  const shY = 0.34;
  const hipY = 0.55;

  p[L.nose] = { x: cx, y: shY - 0.11 };
  p[L.lShoulder] = { x: cx + shoulderW / 2, y: shY };
  p[L.rShoulder] = { x: cx - shoulderW / 2, y: shY };
  p[L.lHip] = { x: cx + hipW / 2, y: hipY };
  p[L.rHip] = { x: cx - hipW / 2, y: hipY };

  // legs: ankles set by stance width, knees solved so the knee angle matches the target
  const thigh = 0.185;
  const shin = 0.185;
  const kneeRad = rad(adavu.kneeAngle);
  const hipAnkle = Math.sqrt(thigh ** 2 + shin ** 2 - 2 * thigh * shin * Math.cos(kneeRad));
  const half = (adavu.stance * shoulderW) / 2;

  // beat animation: alternating thattu strike
  const beat = phase % 1;
  const liftLeft = beat < 0.5;
  const lift = Math.sin(Math.PI * ((beat % 0.5) / 0.5)) * 0.035;

  for (const side of [-1, 1] as const) {
    const isLeft = side === 1;
    const hip = isLeft ? p[L.lHip]! : p[L.rHip]!;
    const ax = cx + side * half;
    const dx = ax - hip.x;
    const dy = Math.sqrt(Math.max(0.0004, hipAnkle ** 2 - dx * dx));
    const ankle: Pt = { x: ax, y: hip.y + dy - (isLeft === liftLeft ? lift : 0) };
    const knee = ik(hip, ankle, thigh, shin, side);
    const heel: Pt = { x: ankle.x - side * 0.012, y: ankle.y + 0.022 };
    const toe: Pt = { x: ankle.x + side * 0.05, y: ankle.y + 0.032 };
    if (isLeft) {
      p[L.lKnee] = knee;
      p[L.lAnkle] = ankle;
      p[L.lHeel] = heel;
      p[L.lToe] = toe;
    } else {
      p[L.rKnee] = knee;
      p[L.rAnkle] = ankle;
      p[L.rHeel] = heel;
      p[L.rToe] = toe;
    }
  }

  // arms: wrist placed at the prescribed elevation above the shoulder line
  const upper = 0.13;
  const fore = 0.13;
  const reach = 0.235;
  const el = rad(adavu.armElevation);
  for (const side of [-1, 1] as const) {
    const isLeft = side === 1;
    const sh = isLeft ? p[L.lShoulder]! : p[L.rShoulder]!;
    const wrist: Pt = {
      x: sh.x + side * reach * Math.cos(el),
      y: sh.y - reach * Math.sin(el),
    };
    const elbow = ik(sh, wrist, upper, fore, -side);
    if (isLeft) {
      p[L.lElbow] = elbow;
      p[L.lWrist] = wrist;
    } else {
      p[L.rElbow] = elbow;
      p[L.rWrist] = wrist;
    }
  }
  return p;
}

export type Deviation = {
  key: string;
  label: string;
  you: string;
  reference: string;
  delta: number;
  severity: "ok" | "minor" | "major";
  /** landmark indices to highlight on the live overlay */
  joints: number[];
};

const angleAt = (a: Pt, b: Pt, c: Pt) => {
  const abx = a.x - b.x,
    aby = a.y - b.y,
    cbx = c.x - b.x,
    cby = c.y - b.y;
  const cos = (abx * cbx + aby * cby) / (Math.hypot(abx, aby) * Math.hypot(cbx, cby) || 1e-6);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};

const sev = (d: number, minor: number, major: number): Deviation["severity"] =>
  d >= major ? "major" : d >= minor ? "minor" : "ok";

/** Compare the dancer's landmarks with the instructor reference, joint by joint. */
export function comparePose(live: Pt[], ref: Pt[]): Deviation[] {
  const sw = (p: Pt[]) => Math.hypot(p[L.lShoulder]!.x - p[L.rShoulder]!.x, p[L.lShoulder]!.y - p[L.rShoulder]!.y) || 0.2;
  const swL = sw(live);
  const swR = sw(ref);

  const kneeAng = (p: Pt[], s: "l" | "r") =>
    s === "l" ? angleAt(p[L.lHip]!, p[L.lKnee]!, p[L.lAnkle]!) : angleAt(p[L.rHip]!, p[L.rKnee]!, p[L.rAnkle]!);
  const stance = (p: Pt[], w: number) => Math.hypot(p[L.lAnkle]!.x - p[L.rAnkle]!.x, p[L.lAnkle]!.y - p[L.rAnkle]!.y) / w;
  const armEl = (p: Pt[], s: "l" | "r") => {
    const sh = s === "l" ? p[L.lShoulder]! : p[L.rShoulder]!;
    const wr = s === "l" ? p[L.lWrist]! : p[L.rWrist]!;
    return (Math.atan2(sh.y - wr.y, Math.abs(wr.x - sh.x) || 1e-6) * 180) / Math.PI;
  };
  const torso = (p: Pt[]) => {
    const sx = (p[L.lShoulder]!.x + p[L.rShoulder]!.x) / 2;
    const sy = (p[L.lShoulder]!.y + p[L.rShoulder]!.y) / 2;
    const hx = (p[L.lHip]!.x + p[L.rHip]!.x) / 2;
    const hy = (p[L.lHip]!.y + p[L.rHip]!.y) / 2;
    return (Math.atan2(sx - hx, hy - sy) * 180) / Math.PI;
  };

  const rows: Deviation[] = [];
  const deg = (
    key: string,
    label: string,
    a: number,
    b: number,
    joints: number[],
    minor = 8,
    major = 18,
    hint = "°",
  ) => {
    const d = Math.abs(a - b);
    rows.push({
      key,
      label,
      you: `${a.toFixed(0)}${hint}`,
      reference: `${b.toFixed(0)}${hint}`,
      delta: Math.round(d),
      severity: sev(d, minor, major),
      joints,
    });
  };

  deg("kneeR", "Right knee (araimandi)", kneeAng(live, "r"), kneeAng(ref, "r"), [L.rHip, L.rKnee, L.rAnkle]);
  deg("kneeL", "Left knee (araimandi)", kneeAng(live, "l"), kneeAng(ref, "l"), [L.lHip, L.lKnee, L.lAnkle]);
  deg("torso", "Torso alignment", torso(live), torso(ref), [L.lShoulder, L.rShoulder, L.lHip, L.rHip], 6, 14);
  deg("armR", "Right arm line", armEl(live, "r"), armEl(ref, "r"), [L.rShoulder, L.rElbow, L.rWrist], 10, 22);
  deg("armL", "Left arm line", armEl(live, "l"), armEl(ref, "l"), [L.lShoulder, L.lElbow, L.lWrist], 10, 22);

  const sYou = stance(live, swL);
  const sRef = stance(ref, swR);
  const sd = Math.abs(sYou - sRef);
  rows.push({
    key: "stance",
    label: "Stance width (padabheda)",
    you: `${sYou.toFixed(2)}×`,
    reference: `${sRef.toFixed(2)}×`,
    delta: Math.round(sd * 100),
    severity: sev(sd, 0.25, 0.6),
    joints: [L.lAnkle, L.rAnkle, L.lToe, L.rToe],
  });

  return rows;
}

export const deviationHint = (d: Deviation) => {
  switch (d.key) {
    case "kneeR":
    case "kneeL":
      return d.you > d.reference ? "Bend deeper — knees are straighter than the guru's." : "Lift slightly — you are sitting lower than the reference.";
    case "torso":
      return "Stack the shoulders over the hips like the reference.";
    case "armR":
    case "armL":
      return parseFloat(d.you) < parseFloat(d.reference) ? "Raise the arm to the reference line." : "Lower the arm to the reference line.";
    default:
      return parseFloat(d.you) < parseFloat(d.reference) ? "Widen the feet to match the reference stance." : "Bring the feet in to match the reference stance.";
  }
};
