"use client";

import { useEffect } from "react";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await signOut();
        // Redirect to home after logout
        router.push("/");
      } catch (error) {
        console.error("Logout error:", error);
        // Still redirect to home even if error
        router.push("/");
      }
    };

    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-void">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h1 className="text-xl font-bold text-accent-gold mb-2">Signing Out...</h1>
        <p className="text-text-secondary">Please wait while we securely log you out.</p>
      </div>
    </div>
  );
}
