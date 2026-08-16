export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  stripePriceId: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 100,
    priceUsd: 9,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? "",
  },
  {
    id: "creator",
    name: "Creator",
    credits: 550,
    priceUsd: 45,
    stripePriceId: process.env.STRIPE_PRICE_CREATOR ?? "",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 1200,
    priceUsd: 90,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? "",
  },
];

export function getCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}
