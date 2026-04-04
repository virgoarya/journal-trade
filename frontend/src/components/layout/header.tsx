import { User, MessageSquare, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import NotificationDropdown from "@/components/layout/NotificationDropdown";

export function Header() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** Automatic Page Title Translation */
  const getPageTitle = (path: string) => {
    switch (path) {
      case "/dashboard": return "Dashboard";
      case "/log-trade": return "Log Trade";
      case "/playbook": return "Strategy Playbook";
      case "/analytics": return "Analytics & Performance";
      case "/ai-review": return "AI Trade Review";
      case "/settings": return "Settings";
      default: return "Hunter Trades Journal";
    }
  };

  return (
    <header className="h-[64px] sticky top-0 z-40 bg-bg-surface/70 backdrop-blur-xl border-b border-white/5 flex justify-between items-center px-8 w-full">
      <div className="flex items-center space-x-4">
        <h2 className="font-sans font-semibold text-[18px] text-text-primary tracking-tight">
          {getPageTitle(pathname)}
        </h2>
      </div>

      <div className="flex items-center space-x-6">
        {/* Notifications Dropdown */}
        <NotificationDropdown />

        {/* User Info with Shortcut to Settings */}
        <Link 
          href="/settings"
          className="flex items-center space-x-3 cursor-pointer group pl-4 border-l border-white/10"
        >
          <div className="text-right">
            <p className="text-[12px] font-medium text-text-primary group-hover:text-accent-gold transition-colors">
              {mounted ? (session?.user?.name || "Elite Hunter") : "Elite Hunter"}
            </p>
            <p className="text-[10px] text-text-secondary">
              {mounted ? ((session?.user as any)?.role === "admin" ? "Founder" : "Elite Member") : "Elite Member"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full border border-accent-gold/30 p-0.5 overflow-hidden transition-all group-hover:border-accent-gold hover:scale-105 bg-bg-elevated flex items-center justify-center">
            {mounted && session?.user?.image ? (
              <img
                src={session.user.image}
                alt="Profile"
                className="w-full h-full object-cover rounded-full"
              />
            ) : mounted && isPending ? (
              <Loader2 className="w-4 h-4 text-accent-gold animate-spin" />
            ) : (
              <User className="text-accent-gold w-5 h-5" />
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
