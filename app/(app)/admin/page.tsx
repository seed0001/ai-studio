import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function AdminPage() {
  await requireAdmin();

  const [userCount, generationCount, creditsPurchased, recentUsers] =
    await Promise.all([
      db.user.count(),
      db.generation.count(),
      db.creditTransaction.aggregate({
        where: { type: "PURCHASE" },
        _sum: { amount: true },
      }),
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          credits: true,
          createdAt: true,
        },
      }),
    ]);

  const stats = [
    { label: "Users", value: userCount },
    { label: "Generations", value: generationCount },
    { label: "Credits purchased", value: creditsPurchased._sum.amount ?? 0 },
  ];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Studio-wide overview.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6"
          >
            <p className="text-sm text-neutral-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-medium">Recent signups</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {recentUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 text-neutral-200">
                    {user.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        user.role === "ADMIN"
                          ? "bg-indigo-500/20 text-indigo-300"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">
                    {user.credits}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {user.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
