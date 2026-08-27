import type { Deviation } from "@/lib/natya/reference";
import { deviationHint } from "@/lib/natya/reference";

const TONE: Record<Deviation["severity"], string> = {
  ok: "border-border/70 bg-secondary/30",
  minor: "border-warning/50 bg-warning/10",
  major: "border-destructive/60 bg-destructive/10",
};

const DOT: Record<Deviation["severity"], string> = {
  ok: "bg-primary",
  minor: "bg-warning",
  major: "bg-destructive",
};

export function ComparisonPanel({ rows }: { rows: Deviation[] }) {
  return (
    <div className="panel space-y-3 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        You vs instructor
      </h3>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Start a session to compare each joint against the instructor reference.
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((d) => (
          <li key={d.key} className={`rounded-lg border p-3 text-sm ${TONE[d.severity]}`}>
            <div className="flex items-center gap-2">
              <span className={`size-2 shrink-0 rounded-full ${DOT[d.severity]}`} />
              <span className="text-foreground">{d.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                you {d.you} · ref {d.reference}
              </span>
            </div>
            {d.severity !== "ok" && (
              <p className="mt-1 pl-4 text-xs text-muted-foreground">{deviationHint(d)}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
