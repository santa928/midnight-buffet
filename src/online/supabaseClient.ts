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

  if (typeof url !== "string" || typeof publishableKey !== "string") {
    throw new Error("オンライン祝宴の接続設定がありません");
  }

  return { url, publishableKey };
}
