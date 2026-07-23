const required = [
  "NEXT_PUBLIC_APP_ID",
  "NEXT_PUBLIC_APP_VERSION",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "APP_ENV",
  "SUPABASE_SECRET_KEY"
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(process.env.NEXT_PUBLIC_APP_ID)) {
  console.error("NEXT_PUBLIC_APP_ID must be a lowercase kebab-case identifier");
  process.exit(1);
}

if (!["local", "test", "production"].includes(process.env.APP_ENV)) {
  console.error("APP_ENV must be local, test, or production");
  process.exit(1);
}

try {
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL");
  process.exit(1);
}

const hasRateLimitUrl = Boolean(process.env.UPSTASH_REDIS_REST_URL);
const hasRateLimitToken = Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
if (hasRateLimitUrl !== hasRateLimitToken) {
  console.error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together");
  process.exit(1);
}

if (process.env.APP_ENV === "production" && (!hasRateLimitUrl || !hasRateLimitToken)) {
  console.error("APP_ENV=production requires distributed rate-limit credentials");
  process.exit(1);
}
