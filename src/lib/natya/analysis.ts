import type { Adavu } from "./adavus";
import type { FrameAnalysis, Metric, MetricKey, Pt } from "./types";

export const L = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
  lHeel: 29,
  rHeel: 30,
  lToe: 31,
  rToe: 32,
};

const angle = (a: Pt, b: Pt, c: Pt) => {
  const abx = a.x - b.x,
    aby = a.y - b.y,
    cbx = c.x - b.x,
    cby = c.y - b.y;
  const cos =
    (abx * cbx + aby * cby) / (Math.hypot(abx, aby) * Math.hypot(cbx, cby) || 1e-6);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** score 100 when |value-target| <= free, decaying to 0 at |diff| = span */
const tolerance = (value: number, target: number, free: number, span: number) => {
  const d = Math.abs(value - target);
  if (d <= free) return 100;
  return Math.max(0, Math.round(100 - ((d - free) / (span - free)) * 100));
};

/** Tracks heel/toe strikes to estimate tempo and beat synchronisation. */
export class FootworkTracker {
  private lastY: number | null = null;
  private lastDir = 0;
  private strikes: number[] = [];
  private beats: number[] = [];

  reset() {
    this.lastY = null;
    this.strikes = [];
    this.beats = [];
  }

  /** feed the lower ankle height (normalised) at time t (ms) */
  push(y: number, t: number, bpm: number) {
    if (this.lastY !== null) {
      const dy = y - this.lastY;
      const dir = Math.abs(dy) < 0.0015 ? this.lastDir : dy > 0 ? 1 : -1;
      if (dir === -1 && this.lastDir === 1) {
        const last = this.strikes[this.strikes.length - 1];
        if (!last || t - last > 180) this.strikes.push(t);
      }
      this.lastDir = dir;
    }
    this.lastY = y;
    this.strikes = this.strikes.filter((s) => t - s < 6000);
    const period = 60000 / bpm;
    this.beats = [];
    for (let k = 0; k < 12; k++) this.beats.push(t - k * period);
  }

  /** measured tempo in bpm, or null when not enough strikes */
  tempo(): number | null {
    if (this.strikes.length < 3) return null;
    const gaps: number[] = [];
    for (let i = 1; i < this.strikes.length; i++) gaps.push(this.strikes[i]! - this.strikes[i - 1]!);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return avg > 0 ? Math.round(60000 / avg) : null;
  }

  /** 0-100 rhythm steadiness (low jitter between strikes) */
  steadiness(): number | null {
    if (this.strikes.length < 4) return null;
    const gaps: number[] = [];
    for (let i = 1; i < this.strikes.length; i++) gaps.push(this.strikes[i]! - this.strikes[i - 1]!);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const dev = Math.sqrt(gaps.reduce((a, b) => a + (b - avg) ** 2, 0) / gaps.length);
    return Math.max(0, Math.round(100 - (dev / Math.max(avg, 1)) * 220));
  }

  strikeCount() {
    return this.strikes.length;
  }
}

export type CameraMode = "full" | "upper";

const inFrame = (pt: Pt | undefined, minVis = 0.35) =>
  !!pt &&
  (pt.visibility ?? 1) >= minVis &&
  pt.x > -0.05 &&
  pt.x < 1.05 &&
  pt.y > -0.05 &&
  pt.y < 1.02;

/**
 * Decide whether the camera sees the whole body or only the upper body.
 * Close-up (3–5 ft) framings drop ankles/knees out of view — we switch to
 * upper-body scoring instead of reporting broken lower-body metrics.
 */
export function detectMode(p: Pt[]): CameraMode {
  const feet = [L.lAnkle, L.rAnkle].filter((i) => inFrame(p[i])).length;
  const knees = [L.lKnee, L.rKnee].filter((i) => inFrame(p[i])).length;
  return feet >= 1 && knees >= 1 ? "full" : "upper";
}

/** Landmarks that must be visible for any scoring to be meaningful. */
export function upperBodyVisible(p: Pt[]) {
  return [L.lShoulder, L.rShoulder].every((i) => inFrame(p[i], 0.2));
}

export function analyzeFrame(
  p: Pt[],
  adavu: Adavu,
  mudras: { left: string; right: string },
  foot: { tempo: number | null; steadiness: number | null },
  mode: CameraMode = "full",
): FrameAnalysis {

  const shoulderW = Math.hypot(p[L.lShoulder]!.x - p[L.rShoulder]!.x, p[L.lShoulder]!.y - p[L.rShoulder]!.y) || 0.2;
  const shoulders = mid(p[L.lShoulder]!, p[L.rShoulder]!);
  const hips = mid(p[L.lHip]!, p[L.rHip]!);

  // --- Araimandi: half-sitting knee flexion
  const kneeL = angle(p[L.lHip]!, p[L.lKnee]!, p[L.lAnkle]!);
  const kneeR = angle(p[L.rHip]!, p[L.rKnee]!, p[L.rAnkle]!);
  const knee = (kneeL + kneeR) / 2;
  const araimandi = tolerance(knee, adavu.kneeAngle, 8, 55);

  // --- Posture: torso verticality + shoulder level + head over hips
  const torsoTilt = (Math.atan2(shoulders.x - hips.x, hips.y - shoulders.y) * 180) / Math.PI;
  const shoulderTilt =
    (Math.atan2(p[L.lShoulder]!.y - p[L.rShoulder]!.y, Math.abs(p[L.lShoulder]!.x - p[L.rShoulder]!.x) || 1e-6) * 180) /
    Math.PI;
  const posture = Math.round(
    0.6 * tolerance(Math.abs(torsoTilt), 0, 4, 28) + 0.4 * tolerance(Math.abs(shoulderTilt), 0, 4, 25),
  );

  // --- Symmetry: mirrored limbs
  const kneeDiff = Math.abs(kneeL - kneeR);
  const wristDiff =
    Math.abs(
      (shoulders.y - p[L.lWrist]!.y) / shoulderW - (shoulders.y - p[L.rWrist]!.y) / shoulderW,
    ) * 100;
  const symmetry =
    mode === "upper"
      ? tolerance(wristDiff, 0, 8, 70)
      : Math.round(0.5 * tolerance(kneeDiff, 0, 6, 45) + 0.5 * tolerance(wristDiff, 0, 8, 70));


  // --- Hasta placement: arm elevation vs shoulder line
  const armEl = (side: "l" | "r") => {
    const sh = side === "l" ? p[L.lShoulder]! : p[L.rShoulder]!;
    const wr = side === "l" ? p[L.lWrist]! : p[L.rWrist]!;
    return (Math.atan2(sh.y - wr.y, Math.abs(wr.x - sh.x) || 1e-6) * 180) / Math.PI;
  };
  const elevation = (armEl("l") + armEl("r")) / 2;
  const armScore = tolerance(elevation, adavu.armElevation, 12, 75);
  const mudraKnown = [mudras.left, mudras.right].filter((m) => m && m !== "—").length;
  const hasta = Math.round(armScore * (mudraKnown === 2 ? 1 : mudraKnown === 1 ? 0.92 : 0.8));

  // --- Padabheda: stance width & foot turnout
  const stance = Math.hypot(p[L.lAnkle]!.x - p[L.rAnkle]!.x, p[L.lAnkle]!.y - p[L.rAnkle]!.y) / shoulderW;
  const turnout =
    (Math.abs((Math.atan2(p[L.lToe]!.y - p[L.lHeel]!.y, p[L.lToe]!.x - p[L.lHeel]!.x) * 180) / Math.PI) +
      Math.abs((Math.atan2(p[L.rToe]!.y - p[L.rHeel]!.y, p[L.rToe]!.x - p[L.rHeel]!.x) * 180) / Math.PI)) /
    2;
  const padabheda = Math.round(
    0.65 * tolerance(stance, adavu.stance, 0.25, 1.6) + 0.35 * tolerance(turnout, 25, 12, 70),
  );

  // --- Footwork & synchronisation with the tala
  const footwork =
    foot.steadiness === null ? 70 : Math.round(0.7 * foot.steadiness + 0.3 * (araimandi > 70 ? 100 : 60));
  const sync =
    foot.tempo === null ? 70 : tolerance(foot.tempo, adavu.tempo, adavu.tempo * 0.06, adavu.tempo * 0.6);

  const metrics: Metric[] = [
    { key: "araimandi", label: "Araimandi", score: araimandi, detail: `Knee angle ${Math.round(knee)}° (target ${adavu.kneeAngle}°)` },
    { key: "posture", label: "Body posture", score: posture, detail: `Torso tilt ${Math.abs(torsoTilt).toFixed(0)}°, shoulders ${Math.abs(shoulderTilt).toFixed(0)}°` },
    { key: "symmetry", label: "Symmetry", score: symmetry, detail: `Knee diff ${kneeDiff.toFixed(0)}°` },
    { key: "hasta", label: "Mudra & hastas", score: hasta, detail: `${mudras.right} / ${mudras.left} · arms ${elevation.toFixed(0)}°` },
    { key: "padabheda", label: "Padabheda", score: padabheda, detail: `Stance ${stance.toFixed(2)}× shoulders · ${adavu.padabheda}` },
    { key: "footwork", label: "Footwork", score: footwork, detail: foot.steadiness === null ? "Listening for thattu…" : `Rhythm steadiness ${foot.steadiness}%` },
    { key: "sync", label: "Tala sync", score: sync, detail: foot.tempo === null ? "Awaiting beats…" : `${foot.tempo} bpm vs ${adavu.tempo} bpm` },
  ];

  const weights: Record<MetricKey, number> = {
    araimandi: 1.3,
    posture: 1.2,
    symmetry: 0.9,
    hasta: 1.1,
    padabheda: 1,
    footwork: 1.1,
    sync: 0.9,
  };
  const wSum = metrics.reduce((a, m) => a + weights[m.key], 0);
  const overall = Math.round(metrics.reduce((a, m) => a + m.score * weights[m.key], 0) / wSum);

  const issues: FrameAnalysis["issues"] = [];
  const flag = (key: MetricKey, score: number, message: string) => {
    if (score < 55) issues.push({ metric: key, message, severity: "major" });
    else if (score < 75) issues.push({ metric: key, message, severity: "minor" });
  };
  flag(
    "araimandi",
    araimandi,
    knee > adavu.kneeAngle ? "Sit deeper into araimandi — knees are too straight." : "Araimandi is too low; lift slightly and keep the spine tall.",
  );
  flag("posture", posture, Math.abs(torsoTilt) > Math.abs(shoulderTilt) ? "Torso is leaning — stack shoulders over hips." : "Shoulders are uneven — level them.");
  flag("symmetry", symmetry, "Left and right sides differ — mirror both limbs equally.");
  flag("hasta", hasta, elevation < adavu.armElevation ? "Lift the arms to the correct hasta level." : "Lower the arms to the prescribed hasta level.");
  flag("padabheda", padabheda, stance < adavu.stance ? "Widen the stance for this padabheda." : "Stance is too wide — bring the feet in.");
  if (foot.steadiness !== null) flag("footwork", footwork, "Footwork is uneven — strike the floor with even weight.");
  if (foot.tempo !== null)
    flag("sync", sync, (foot.tempo ?? 0) > adavu.tempo ? "You are rushing ahead of the tala." : "You are lagging behind the tala.");

  return { metrics, overall, mudra: mudras, issues };
}

export const gradeFor = (s: number) =>
  s >= 90 ? "Uttama (Excellent)" : s >= 78 ? "Madhyama+ (Very good)" : s >= 65 ? "Madhyama (Good)" : s >= 50 ? "Sadhaka (Developing)" : "Abhyasa (Needs practice)";

export const SUGGESTION_BANK: Record<MetricKey, string> = {
  araimandi: "Practise 3 minutes of static araimandi daily against a wall to build thigh endurance.",
  posture: "Keep the spine erect and the chest open; imagine a thread pulling the crown upward.",
  symmetry: "Rehearse in front of a mirror and repeat the weaker side twice as often.",
  hasta: "Drill asamyuta hastas slowly, holding each mudra for eight counts before adding arm lines.",
  padabheda: "Mark the floor with tape to fix stance width for each padabheda.",
  footwork: "Recite the sollukattu aloud while practising so every thattu lands with equal force.",
  sync: "Practise with a metronome at 80% tempo, then raise it by 5 bpm once clean.",
};
