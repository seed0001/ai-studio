import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CREDIT_PACKS } from "@/lib/credit-packs";
import { BuyCreditsButton } from "@/components/BuyCreditsButton";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const transactions = await db.creditTransaction.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-neutral-400">
          You have {session!.user.credits} credits.
        </p>
      </div>

      {params.success && (
        <p className="rounded-lg border border-emerald-800 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
          Purchase complete — credits have been added to your account.
        </p>
      )}
      {params.canceled && (
        <p className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-400">
          Checkout canceled.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/50 p-6"
          >
            <h3 className="font-medium text-white">{pack.name}</h3>
            <p className="mt-2 text-3xl font-semibold text-white">
              ${pack.priceUsd}
            </p>
            <p className="mt-1 text-sm text-neutral-400">
              {pack.credits} credits
            </p>
            <div className="mt-6">
              <BuyCreditsButton packId={pack.id} />
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-medium">Transaction history</h2>
        <div className="mt-4 divide-y divide-neutral-900 rounded-xl border border-neutral-800">
          {transactions.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-500">
              No transactions yet.
            </p>
          )}
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="text-neutral-300 capitalize">
                {tx.type.toLowerCase()}
              </span>
              <span
                className={
                  tx.amount > 0 ? "text-emerald-400" : "text-neutral-400"
                }
              >
                {tx.amount > 0 ? "+" : ""}
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
