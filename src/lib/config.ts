export const SESSION_COOKIE = "splittab_uid";

export function isMemoryBackend() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function demoSeedEnabled() {
  return process.env.SPLITTAB_DEMO_SEED !== "0";
}
