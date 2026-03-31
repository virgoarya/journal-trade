import type { Auth } from "better-auth";

// Global auth instance, will be set after database connection
export let authInstance: any = null;

export const setAuthInstance = (auth: any) => {
  authInstance = auth;
};
