import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupabasePublicConfig } from "./supabasePublicConfig";

let browserClientPromise: Promise<SupabaseClient> | undefined;

/** Lazily creates one shared browser auth client after online mode is entered. */
export function createBrowserSupabaseClient(): Promise<SupabaseClient> {
  browserClientPromise ??= import("@supabase/supabase-js").then(({ createClient }) => {
    const config = readSupabasePublicConfig(import.meta.env);
    return createClient(config.url, config.publishableKey);
  });
  return browserClientPromise;
}
