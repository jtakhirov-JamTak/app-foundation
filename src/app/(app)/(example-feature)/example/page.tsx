import type { Metadata } from "next";

import { ExampleScreen } from "../_feature/example-screen";

export const metadata: Metadata = { title: "Example" };
export const dynamic = "force-static";

export default function ExamplePage() {
  return <ExampleScreen />;
}
