/**
 * Wearables are drawn as an SVG layer pinned over the canvas sprite.
 * The runtime paints the Friend into an 80x80 box, so every piece is
 * authored in that same 80x80 space and lines up at any window size.
 *
 * Measured against the rendered sprite: the head fills the top of the box,
 * the eye line sits near y=22, and headwear floats above y=0 (the layer
 * allows overflow, so negative coordinates are intentional).
 */
export type CosmeticSlot = "eye" | "head";

export type Cosmetic = Readonly<{
  id: string;
  name: string;
  slot: CosmeticSlot;
  /** Whole RF; converted to base units where it is spent. */
  price: bigint;
  /** Ascension tier required before the shop will sell it. */
  tier: number;
  blurb: string;
}>;

export const COSMETICS: readonly Cosmetic[] = [
  { id: "shades", name: "Shades", slot: "eye", price: 2n, tier: 0, blurb: "Standard issue. Cuts the glare off the solar array." },
  { id: "visor", name: "Pulse Visor", slot: "eye", price: 5n, tier: 1, blurb: "A thin band of running light." },
  { id: "scope", name: "Optic Scope", slot: "eye", price: 9n, tier: 2, blurb: "Salvaged from a survey drone." },
  { id: "cap", name: "Signal Cap", slot: "head", price: 3n, tier: 0, blurb: "Keeps a weak uplink alive." },
  { id: "halo", name: "Orbit Halo", slot: "head", price: 7n, tier: 2, blurb: "A ring that never quite touches the head." },
  { id: "crown", name: "Ascendant Crown", slot: "head", price: 14n, tier: 3, blurb: "Only the Core can authorise this one." },
];

export const cosmeticById = (id: string) => COSMETICS.find(item => item.id === id) ?? null;

/** Art for one wearable, in the sprite's own 80x80 coordinate space. */
export function CosmeticArt({ id }: { id: string }) {
  switch (id) {
    case "shades":
      return (
        <g>
          <rect x="25" y="17" width="30" height="2.5" fill="#dff3ff" />
          <rect x="26" y="18" width="12" height="7" rx="1" fill="#0a1016" stroke="#dff3ff" strokeWidth="1.2" />
          <rect x="42" y="18" width="12" height="7" rx="1" fill="#0a1016" stroke="#dff3ff" strokeWidth="1.2" />
          <rect x="28" y="19.5" width="4" height="1.5" fill="#7fb8cf" />
        </g>
      );
    case "visor":
      return (
        <g>
          <rect x="24" y="17" width="32" height="9" rx="4" fill="#04222c" opacity="0.94" />
          <rect x="28" y="20" width="24" height="2" rx="1" fill="#00e5ff" />
        </g>
      );
    case "scope":
      return (
        <g>
          <rect x="25" y="18" width="30" height="6" rx="2" fill="#0a1016" stroke="#dff3ff" strokeWidth="1.2" />
          <circle cx="46" cy="21" r="6" fill="#04222c" stroke="#00e5ff" strokeWidth="2" />
          <circle cx="46" cy="21" r="2" fill="#00e5ff" />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M24 10 q16 -13 32 0 z" fill="#0a1016" stroke="#dff3ff" strokeWidth="1.2" />
          <rect x="19" y="9" width="42" height="3" rx="1.5" fill="#0a1016" stroke="#dff3ff" strokeWidth="1" />
          <rect x="39" y="-5" width="2" height="8" fill="#0a1016" />
          <circle cx="40" cy="-6" r="3" fill="#00e5ff" />
        </g>
      );
    case "halo":
      return (
        <g>
          <ellipse cx="40" cy="-6" rx="17" ry="5" fill="none" stroke="#00e5ff" strokeWidth="3" opacity="0.95" />
          <ellipse cx="40" cy="-6" rx="17" ry="5" fill="none" stroke="#dffbff" strokeWidth="1" />
        </g>
      );
    case "crown":
      return (
        <g>
          <path d="M22 10 L22 -3 L30 4 L40 -8 L50 4 L58 -3 L58 10 Z" fill="#00e5ff" stroke="#04222c" strokeWidth="1.5" />
          <circle cx="40" cy="-10" r="3" fill="#dffbff" stroke="#04222c" strokeWidth="1" />
        </g>
      );
    default:
      return null;
  }
}
