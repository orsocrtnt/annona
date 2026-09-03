import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["leaflet", "react-leaflet"],
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
    optimizePackageImports: ["lucide-react"],
    clientSegmentCache: true,
  },
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
