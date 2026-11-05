import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/security-headers";

const nextConfig: NextConfig = {
  transpilePackages: ["leaflet", "react-leaflet"],
  // Tarifs et démonstration en ligne retirés du site public pour le moment (5 novembre 2026).
  // Redirections temporaires (307) : les pages restent dans le code pour être rouvertes plus tard.
  async redirects() {
    return [
      { source: "/tarifs", destination: "/fonctionnalites", permanent: false },
      { source: "/demonstration", destination: "/#demo", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: buildSecurityHeaders() }];
  },
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
