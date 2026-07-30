// Lighthouse CI configuration (.cjs instead of .json so budgets can be documented).
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start -- -p 3200",
      startServerReadyPattern: "Ready",
      // `/` is deliberately absent. Unauthenticated `/` client-redirects to
      // `/sign-in`, so collecting it measured the sign-in page a second time
      // with a redirect hop attached — duplicate coverage under a misleading
      // name, and any budget calibrated against it is invalidated the moment
      // `/` becomes a real page. START_NEW_APP.md carries the scaffold step to
      // add it back once that happens.
      url: ["http://127.0.0.1:3200/sign-in"],
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
      // Kept as a matrix (rather than a flat `assertions` block) so re-adding a
      // URL with its own budgets stays purely additive.
      assertMatrix: [
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
