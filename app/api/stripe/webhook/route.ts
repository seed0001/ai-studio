import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { addPurchasedCredits } from "@/lib/credits";
import { Prisma } from "@/app/generated/prisma/client";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const credits = Number(session.metadata?.credits ?? 0);

    if (userId && credits > 0) {
      try {
        await addPurchasedCredits({
          userId,
          amount: credits,
          stripeSessionId: session.id,
        });
      } catch (err) {
        // Unique constraint on stripeSessionId means this event was already
        // processed (Stripe retries webhooks) — treat as success.
        const isDuplicate =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002";
        if (!isDuplicate) throw err;
      }
    }
  }

  return NextResponse.json({ received: true });
}
