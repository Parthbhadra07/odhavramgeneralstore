import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  images: {
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
  // Silence Turbopack warning when PWA plugin adds webpack config
  turbopack: {},
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/offline",
  },
})(nextConfig);
