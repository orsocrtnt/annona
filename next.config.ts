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
    // Outil de dev Next 15.5 : ses nœuds autour de chaque segment décalent les useId entre
    // le rendu serveur et le client (ids Radix des menus → avertissement d'hydratation). Sans effet en production.
    devtoolSegmentExplorer: false,
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
