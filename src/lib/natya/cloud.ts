import { supabase } from "@/integrations/supabase/client";
import type { SessionReport } from "./types";

export type CloudSession = {
  id: string;
  adavu: string;
  grade: string;
  accuracy: number;
  duration_seconds: number;
  camera_mode: string;
  metrics: { key: string; label: string; score: number }[];
  mudras: string[];
  mistake_count: number;
  feedback: string[];
  performed_at: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  practice_streak: number;
  longest_streak: number;
  total_minutes: number;
  last_practice_date: string | null;
};

/** Persist a finished session for the signed-in user (no-op when signed out). */
export async function saveCloudSession(
  report: SessionReport,
  extra: { cameraMode: string; mudras: string[] },
) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { error } = await supabase.from("practice_sessions").insert({
    user_id: data.user.id,
    adavu: report.adavu,
    grade: report.grade,
    accuracy: report.overall,
    duration_seconds: Math.round(report.durationMs / 1000),
    camera_mode: extra.cameraMode,
    metrics: report.averages,
    mudras: extra.mudras,
    mistake_count: report.mistakes.length,
    feedback: report.suggestions,
    performed_at: new Date(report.startedAt).toISOString(),
  });
  if (error) throw error;
  return true;
}

export async function fetchCloudSessions(): Promise<CloudSession[]> {
  const { data, error } = await supabase
    .from("practice_sessions")
    .select("id, adavu, grade, accuracy, duration_seconds, camera_mode, metrics, mudras, mistake_count, feedback, performed_at")
    .order("performed_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as CloudSession[];
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, practice_streak, longest_streak, total_minutes, last_practice_date")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Profile) ?? null;
}
