export type Pt = { x: number; y: number; z?: number; visibility?: number };

export type MetricKey =
  | "araimandi"
  | "posture"
  | "symmetry"
  | "hasta"
  | "padabheda"
  | "footwork"
  | "sync";

export type Metric = {
  key: MetricKey;
  label: string;
  score: number; // 0-100
  detail: string;
};

export type Mistake = {
  id: string;
  t: number; // ms into session
  metric: MetricKey;
  message: string;
  deduction: number;
  severity: "minor" | "major";
};

export type FrameAnalysis = {
  metrics: Metric[];
  overall: number;
  mudra: { left: string; right: string };
  issues: { metric: MetricKey; message: string; severity: "minor" | "major" }[];
};

export type SessionReport = {
  id: string;
  adavu: string;
  startedAt: number;
  durationMs: number;
  overall: number;
  grade: string;
  averages: { key: MetricKey; label: string; score: number }[];
  deductions: { metric: MetricKey; label: string; count: number; points: number }[];
  mistakes: Mistake[];
  timeline: { t: number; score: number }[];
  suggestions: string[];
};
