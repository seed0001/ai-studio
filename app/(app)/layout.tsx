import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/dashboard", label: "Generate" },
  { href: "/library", label: "Library" },
  { href: "/billing", label: "Billing" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const navLinks =
    session.user.role === "ADMIN"
      ? [...NAV_LINKS, { href: "/admin", label: "Admin" }]
      : NAV_LINKS;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
              AI Studio
            </Link>
            <nav className="flex items-center gap-6 text-sm text-neutral-400">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-white">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/billing"
              className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-sm text-neutral-200 hover:border-neutral-600"
            >
              {session.user.credits} credits
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="text-sm text-neutral-400 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
