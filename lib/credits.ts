import { db } from "@/lib/db";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
  }
}

export async function spendCredits(params: {
  userId: string;
  amount: number;
  generationId: string;
}) {
  const { userId, amount, generationId } = params;

  await db.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id: userId, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });

    if (result.count === 0) {
      throw new InsufficientCreditsError();
    }

    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -amount,
        type: "GENERATION",
        generationId,
      },
    });
  });
}

export async function refundCredits(params: {
  userId: string;
  amount: number;
  generationId: string;
}) {
  const { userId, amount, generationId } = params;

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    }),
    db.creditTransaction.create({
      data: {
        userId,
        amount,
        type: "REFUND",
        generationId,
      },
    }),
  ]);
}

export async function addPurchasedCredits(params: {
  userId: string;
  amount: number;
  stripeSessionId: string;
}) {
  const { userId, amount, stripeSessionId } = params;

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    }),
    db.creditTransaction.create({
      data: {
        userId,
        amount,
        type: "PURCHASE",
        stripeSessionId,
      },
    }),
  ]);
}
