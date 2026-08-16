"use client";

import { useState } from "react";

export function BuyCreditsButton({ packId }: { packId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId }),
    });

    const data = await res.json();

    if (!res.ok || !data.url) {
      setLoading(false);
      setError(data.error ?? "Something went wrong");
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Redirecting…" : "Buy"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
