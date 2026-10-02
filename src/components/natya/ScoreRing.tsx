export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const tone = score >= 78 ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--destructive)";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={9} stroke="var(--border)" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={9}
          stroke={tone}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.max(0, Math.min(100, score))) / 100}
          style={{ transition: "stroke-dashoffset .35s ease, stroke .35s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-semibold text-foreground">{Math.round(score)}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">score</span>
      </div>
    </div>
  );
}

export function MetricBar({ label, score, detail }: { label: string; score: number; detail: string }) {
  const tone = score >= 78 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-destructive";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{Math.round(score)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone} transition-all duration-300`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
