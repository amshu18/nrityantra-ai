import type { Pt } from "./types";

const TIPS = [4, 8, 12, 16, 20];
const PIPS = [2, 6, 10, 14, 18];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Classify a single-hand asamyuta hasta from 21 MediaPipe hand landmarks. */
export function classifyMudra(lm: Pt[] | null | undefined): string {
  if (!lm || lm.length < 21) return "—";
  const wrist = lm[0]!;
  const palm = dist(wrist, lm[9]!) || 1;
  const extended = TIPS.map((tip, i) => dist(wrist, lm[tip]) > dist(wrist, lm[PIPS[i]]) * 1.05);
  const [thumb, index, middle, ring, pinky] = extended;
  const spread = dist(lm[8]!, lm[20]!) / palm;
  const thumbIndex = dist(lm[4]!, lm[8]!) / palm;
  const count = extended.filter(Boolean).length;

  if (count === 0) return "Mushti";
  if (index && middle && ring && pinky) {
    if (spread > 1.15) return thumb ? "Alapadma" : "Pataka";
    if (!thumb) return "Pataka";
    return "Ardhachandra";
  }
  if (index && middle && ring && !pinky) return "Tripataka";
  if (index && middle && !ring && !pinky) return spread > 0.5 ? "Kartarimukha" : "Sikhara";
  if (index && !middle && !ring && pinky) return "Simhamukham";
  if (index && !middle && !ring && !pinky) return "Suchi";
  if (!index && !middle && !ring && pinky) return "Chandrakala";
  if (thumbIndex < 0.35 && middle) return "Katakamukha";
  if (thumb && count === 1) return "Sikhara";
  return "Mrigasirsha";
}

export const MUDRA_NOTES: Record<string, string> = {
  Pataka: "Flag hand — keep all fingers joined and the thumb bent at the base.",
  Tripataka: "Three parts of the flag — only the ring finger bends.",
  Ardhachandra: "Half-moon — stretch the thumb away from the joined fingers.",
  Kartarimukha: "Scissors — separate index and middle wide, fold the rest.",
  Alapadma: "Lotus — spread every finger evenly like petals.",
  Mushti: "Fist — thumb rests over the folded fingers.",
  Suchi: "Needle — only the index points, wrist stays firm.",
  Katakamukha: "Thumb, index and middle meet delicately.",
  Sikhara: "Thumb raised from a closed fist.",
  Mrigasirsha: "Deer head — thumb and little finger extended.",
  Chandrakala: "Crescent — thumb and index stretched apart.",
  Simhamukham: "Lion face — middle and ring meet the thumb.",
};
