import withSerwistInit from "@serwist/next";

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "development";
const additionalPrecacheEntries = [
  { url: "/", revision: appVersion },
  { url: "/settings", revision: appVersion },
  { url: "/offline", revision: appVersion },
  { url: "/manifest.webmanifest", revision: appVersion },
  { url: "/icon-192.png", revision: appVersion },
  { url: "/icon-512.png", revision: appVersion },
];

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: false,
  cacheOnNavigation: false,
  additionalPrecacheEntries,
  exclude: [
    /middleware-manifest\.json$/,
    /_buildManifest\.js$/,
    /_ssgManifest\.js$/,
    /server\/app\/.*\.rsc$/,
    // Route handlers emit stub client chunks (e.g. chunks/app/api/session/
    // route-*.js) that the client never loads; keep every /api/ path out of
    // the precache manifest.
    /\/api\//,
  ],
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
          },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
