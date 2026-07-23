import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

import { isSensitiveRequest } from "@/lib/pwa/request-policy";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const appId = process.env.NEXT_PUBLIC_APP_ID ?? "application";
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "development";
const cacheId = `${appId}-${appVersion}`;

const serwist = new Serwist({
  cacheId,
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cacheName: `${cacheId}-precache`,
    cleanupOutdatedCaches: true,
    fallbackToNetwork: false
  },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: ({ url, request }) => isSensitiveRequest(url, request, self.location.origin),
      handler: new NetworkOnly()
    },
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly()
    }
  ]
});

serwist.setCatchHandler(async ({ request }) => {
  if (request.destination === "document") {
    return (await serwist.matchPrecache("/offline")) ?? Response.error();
  }
  return Response.error();
});

serwist.addEventListeners();
