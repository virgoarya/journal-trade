import { createAuthClient } from "better-auth/react";

// Empty baseURL = same-origin requests → goes through Next.js proxy
// Next.js rewrites /api/* → http://localhost:5000/api/* (see next.config.ts)
// This ensures cookies are forwarded correctly on the same domain.
export const authClient = createAuthClient({
  baseURL: "", // Revert to empty: use Next.js proxy to avoid cross-origin cookie issues on gadget
  credentials: "include",
});

export const { signIn, signUp, useSession, signOut } = authClient;
