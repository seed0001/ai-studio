import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      const dbUser = user as typeof user & {
        credits: number;
        role: "USER" | "ADMIN";
      };
      session.user.id = dbUser.id;
      session.user.credits = dbUser.credits;
      session.user.role = dbUser.role;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // The very first account ever created is bootstrapped as admin.
      const userCount = await db.user.count();
      if (userCount === 1) {
        await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      }
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
});
