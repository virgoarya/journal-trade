declare module "better-auth/react" {
  export interface AuthClient {
    signIn: {
      (options: { email: string; password: string; callbackURL?: string }): Promise<any>;
      social: (options: { provider: string; callbackURL?: string }) => Promise<any>;
      [key: string]: any;
    };
    signUp: (options: { email: string; password: string; name?: string; callbackURL?: string }) => Promise<any>;
    signOut: (options?: { fetchOptions?: RequestInit }) => Promise<any>;
    useSession: () => { data: any; isPending: boolean; error: any; refetch: () => Promise<any> };
    getSession: (options?: { fetchOptions?: RequestInit }) => Promise<any>;
    $fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    $Infer: {
      Session: any;
    };
  }
  export function createAuthClient(options?: { baseURL?: string; credentials?: string }): AuthClient;
}