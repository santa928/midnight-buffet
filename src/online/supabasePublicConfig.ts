export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

/** Reads the only Supabase values that may be embedded in a browser build. */
export function readSupabasePublicConfig(
  env: Record<string, string | boolean | undefined>,
): SupabasePublicConfig {
  const url = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!isNonEmptyString(url) || !isNonEmptyString(publishableKey)) {
    throw new Error("オンライン祝宴の接続設定がありません");
  }

  return { url, publishableKey };
}

/** Reports whether the browser build has enough public config to open online rooms. */
export function hasSupabasePublicConfig(env: Record<string, string | boolean | undefined>): boolean {
  return isNonEmptyString(env.VITE_SUPABASE_URL) && isNonEmptyString(env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

/** Narrows Vite env values while rejecting Docker Compose's empty-string defaults. */
function isNonEmptyString(value: string | boolean | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
