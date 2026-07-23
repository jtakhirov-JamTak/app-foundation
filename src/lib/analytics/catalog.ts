export interface ScreenCatalog {
  home: true;
  settings: true;
}

export type ScreenName = Extract<keyof ScreenCatalog, string>;

export type NavigationType = "navigate" | "reload" | "back-forward" | "prerender";
export type VitalName = "LCP" | "INP" | "CLS";
export type VitalRating = "good" | "needs-improvement" | "poor";

export interface ErrorAreaCatalog {
  global: true;
  protected_route: true;
  analytics: true;
}

export type ErrorArea = Extract<keyof ErrorAreaCatalog, string>;

export interface ErrorCodeCatalog {
  UNHANDLED_APPLICATION_ERROR: true;
  ROUTE_RENDER_FAILED: true;
  ANALYTICS_WRITE_FAILED: true;
}

export type ErrorCode = Extract<keyof ErrorCodeCatalog, string>;

export interface EventProperties {
  screen_viewed: {
    screen: ScreenName;
    referrer_screen?: ScreenName;
  };
  navigation_feedback_measured: {
    from: ScreenName;
    to: ScreenName;
    feedback_ms: number;
  };
  web_vital_recorded: {
    metric: VitalName;
    value: number;
    rating: VitalRating;
    navigation_type: NavigationType;
    screen: ScreenName;
  };
  app_error_recorded: {
    area: ErrorArea;
    code: ErrorCode;
    recoverable: boolean;
  };
}

export type EventName = Extract<keyof EventProperties, string>;
