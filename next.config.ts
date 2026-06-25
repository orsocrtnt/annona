import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tanstack/react-query", "leaflet", "react-leaflet"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
