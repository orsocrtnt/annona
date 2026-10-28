import { TOUR_PROOF } from "@/features/landing/product-tour/tour-data";

/** Photo de preuve dessinée : colis déposé devant la porte, avec l'horodatage incrusté. */
export function ProofPhoto({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 130" role="img" aria-label={`Photo du colis livré, ${TOUR_PROOF.time}`} className={className}>
      <rect width="200" height="130" fill="#e9efe9" />
      <rect x="0" y="96" width="200" height="34" fill="#d5ddd6" />
      <rect x="62" y="10" width="76" height="88" rx="3" fill="#7c5c3e" />
      <rect x="68" y="16" width="64" height="78" rx="2" fill="#94704f" />
      <circle cx="122" cy="58" r="3" fill="#e9c46a" />
      <path d="M78 82 L122 82 L128 112 L72 112 Z" fill="#c8995f" />
      <path d="M72 112 L78 82 L100 76 L122 82 L128 112" fill="none" stroke="#a87b45" strokeWidth="1.5" />
      <rect x="96" y="82" width="8" height="30" fill="#e8d1a8" />
      <rect x="6" y="110" width="98" height="14" rx="4" fill="#0e1310" fillOpacity="0.72" />
      <text x="12" y="120" fontSize="8" fontWeight="600" fill="#ffffff">
        {TOUR_PROOF.time} · Roquette, 11e
      </text>
    </svg>
  );
}
