import NextAuth from "next-auth";

// Lightweight config for middleware — no DB imports, no bcryptjs
// Only needs to read the JWT session cookie
export const { auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
