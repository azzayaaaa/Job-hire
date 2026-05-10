import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "") || "http://localhost:5000";
          const res = await fetch(`${gatewayUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credentials),
          });
          const data = await res.json();
          if (res.ok && data.user) {
            return {
              ...data.user,
              id: String(data.user.id),
              userType: data.user.userType,
              credits: data.user.credits,
              accessToken: data.token,
            };
          }
          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account }) => {
      if (account?.provider === "google") {
        try {
          console.log(`[NextAuth] Google sign-in attempt for: ${user.email}`);
          
          const gatewayUrl =
            process.env.NEXT_PUBLIC_GATEWAY_URL?.replace(/\/$/, "") ||
            "http://localhost:5000";

          // Role selection transport from /register:
          // /register sets: pendingUserType=EMPLOYER|CANDIDATE (valid for 300s)
          // OAuth callback happens after redirect, so we read it server-side here.
          const cookieStore = await cookies();
          const pendingUserTypeRaw = cookieStore.get("pendingUserType")?.value;
          const pendingUserType = pendingUserTypeRaw?.toUpperCase();

          const normalizedUserType =
            pendingUserType === "EMPLOYER" || pendingUserType === "CANDIDATE" || pendingUserType === "ADMIN"
              ? pendingUserType
              : undefined;

          // Avoid reusing the same role nonce/cookie for later logins.
          // (If delete is unsupported in this Next runtime, it's harmless to skip.)
          try {
            cookieStore.delete("pendingUserType");
          } catch {}

          const res = await fetch(`${gatewayUrl}/api/auth/google-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              image: user.image,
              ...(normalizedUserType ? { userType: normalizedUserType } : {}),
            }),
          });

          if (!res.ok) {
            const errorData = await res.json();
            console.error("[NextAuth] Google Auth Backend Error:", errorData);
            return false;
          }

          const data = await res.json();
          console.log("[NextAuth] Google Auth Success:", data.user.email);

          if (user.email === "azzayabayartai07@gmail.com") {
            (user as any).userType = "ADMIN";
          } else {
            (user as any).userType = data.user.userType;
          }
          (user as any).id = String(data.user.id);
          (user as any).credits = data.user.credits;
          (user as any).accessToken = data.token;
          return true;
        } catch (error) {
          console.error("[NextAuth] Google Auth Error:", error);
          return false;
        }
      }
      return true;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as any).id;
        token.userType = (user as any).userType;
        token.credits = (user as any).credits;
        token.accessToken = (user as any).accessToken;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).userType = token.userType as string;
        (session.user as any).credits = token.credits as number;
        (session.user as any).accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
});

export { handler as GET, handler as POST };
