import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The service worker must never be cached, so a new version reaches the phone at once.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Post-import uploads send one image per request. Vercel caps a function
      // request body at 4.5MB, so stay just under it.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
