import { registerScreenPath } from "@/lib/analytics/screen-registry";

declare module "@/lib/analytics/catalog" {
  interface ScreenCatalog {
    example: true;
  }

  interface ErrorAreaCatalog {
    example: true;
  }

  interface ErrorCodeCatalog {
    EXAMPLE_LOAD_FAILED: true;
    EXAMPLE_SAVE_FAILED: true;
  }

  interface EventProperties {
    example_record_created: {
      source: "example_form";
    };
  }
}

registerScreenPath("/example", "example");

export {};
