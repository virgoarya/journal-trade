import { createAuthClient } from "better-auth/react";

// Use environment variable or default to localhost
const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export const authClient = createAuthClient({
    baseURL,
});

export const { signIn, signUp, useSession, signOut } = authClient;
