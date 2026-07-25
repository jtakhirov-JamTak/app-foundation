// Lighthouse CI configuration (.cjs instead of .json so budgets can be documented).
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start -- -p 3200",
      startServerReadyPattern: "Ready",
      url: ["http://127.0.0.1:3200/", "http://127.0.0.1:3200/sign-in"],
      numberOfRuns: 3,
      settings: {
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          disabled: false,
        },
      },
    },
    assert: {
      assertMatrix: [
        {
          // "/" unauthenticated redirects to /sign-in; LCP includes the redirect hop
          // and does not represent the signed-in shell cold start. Calibrated
          // 2026-07-24 against the first real Lighthouse run (median 3098 ms + ~10%).
          matchingUrlPattern: "http://[^/]+/$",
          assertions: {
            "largest-contentful-paint": ["error", { maxNumericValue: 3400 }],
            "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
            "total-blocking-time": ["error", { maxNumericValue: 200 }],
            "categories:performance": ["warn", { minScore: 0.9 }],
          },
        },
        {
          matchingUrlPattern: "/sign-in",
          assertions: {
            "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
            "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
            "total-blocking-time": ["error", { maxNumericValue: 200 }],
            "categories:performance": ["warn", { minScore: 0.9 }],
          },
        },
      ],
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
