import { signIn } from "@/lib/auth";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-neutral-800 bg-neutral-900 p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold text-white">Sign in</h1>
          <p className="text-sm text-neutral-400">
            Continue to your AI Studio account.
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200"
          >
            Continue with Google
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-800" />
          <span className="text-xs text-neutral-500">or</span>
          <div className="h-px flex-1 bg-neutral-800" />
        </div>

        <form
          action={async (formData) => {
            "use server";
            await signIn("resend", {
              email: formData.get("email"),
              redirectTo: "/dashboard",
            });
          }}
          className="space-y-3"
        >
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            Send magic link
          </button>
        </form>
      </div>
    </div>
  );
}
