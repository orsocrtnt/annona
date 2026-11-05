import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/security-headers";

const nextConfig: NextConfig = {
  transpilePackages: ["leaflet", "react-leaflet"],
  // Démonstration en ligne retirée du site public pour le moment (5 novembre 2026).
  // Redirection temporaire (307) : la page reste dans le code pour être rouverte plus tard.
  // /tarifs est devenue une page provisoire « bientôt disponible » avec liste d'attente.
  async redirects() {
    return [
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
