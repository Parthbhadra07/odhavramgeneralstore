import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  output: isCapacitorBuild ? "export" : undefined,
  trailingSlash: isCapacitorBuild ? true : false,
  images: {
    unoptimized: isCapacitorBuild,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.quickpantry.in",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.quickpantry.in",
        pathname: "/**",
      },
    ],
  },
  turbopack: {},
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ url }: { url: URL }) =>
          url.hostname.includes("supabase.co"),
        handler: "NetworkFirst",
        options: {
          cacheName: "supabase-api",
          networkTimeoutSeconds: 12,
          expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|webp|gif|svg|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "product-images",
          expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: ({ request }: { request: Request }) =>
          request.destination === "document",
        handler: "NetworkFirst",
        options: {
          cacheName: "app-shell",
          networkTimeoutSeconds: 8,
        },
      },
    ],
  },
})(nextConfig);
