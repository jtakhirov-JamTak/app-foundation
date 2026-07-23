import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    clearMocks: true,
    restoreMocks: true,
    env: {
      NEXT_PUBLIC_APP_ID: "test-application",
      NEXT_PUBLIC_APP_VERSION: "test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_test_000000000000000000000000000000",
      APP_ENV: "test",
      SUPABASE_SECRET_KEY: "sb_secret_test_000000000000000000000000000000",
      NODE_ENV: "test"
    },
    coverage: {
      reporter: ["text", "json", "html"]
    }
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});
