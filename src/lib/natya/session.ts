import type { SessionReport } from "./types";

const KEY = "natya.sessions.v1";

export function loadSessions(): SessionReport[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SessionReport[];
  } catch {
    return [];
  }
}

export function saveSession(report: SessionReport) {
  if (typeof window === "undefined") return;
  const all = [report, ...loadSessions()].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(all));
}
