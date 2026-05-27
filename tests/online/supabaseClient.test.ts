import { describe, expect, it } from "vitest";
import { readSupabasePublicConfig } from "../../src/online/supabaseClient";

describe("Supabase public client configuration", () => {
  it("accepts only the project URL and publishable key required by the browser", () => {
    expect(
      readSupabasePublicConfig({
        VITE_SUPABASE_URL: "https://project.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("fails with a usable message when online configuration is absent", () => {
    expect(() => readSupabasePublicConfig({})).toThrow(
      "オンライン祝宴の接続設定がありません",
    );
  });
});
