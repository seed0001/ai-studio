import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCreditPack } from "@/lib/credit-packs";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { packId } = await req.json();
  const pack = getCreditPack(packId);
  if (!pack || !pack.stripePriceId) {
    return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: pack.stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/billing?success=true`,
    cancel_url: `${appUrl}/billing?canceled=true`,
    client_reference_id: session.user.id,
    metadata: {
      userId: session.user.id,
      packId: pack.id,
      credits: String(pack.credits),
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
