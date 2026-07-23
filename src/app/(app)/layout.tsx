import type { ReactNode } from "react";

import { AppProviders } from "@/components/app-shell/app-providers";
import { AppShell } from "@/components/app-shell/app-shell";

export const dynamic = "force-static";

export default function ProtectedShellLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppProviders>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
