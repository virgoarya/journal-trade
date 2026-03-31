import { Bell, User, MessageSquare, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export function Header() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();

  /** Terjemahan Judul Halaman Otomatis */
  const getPageTitle = (path: string) => {
    switch (path) {
      case "/dashboard": return "Dasbor";
      case "/log-trade": return "Catat Trade";
      case "/playbook": return "Playbook Strategi";
      case "/analytics": return "Analitik & Performa";
      case "/ai-review": return "AI Trade Review";
      case "/settings": return "Pengaturan";
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
        {/* Notifications */}
        <div className="relative cursor-pointer hover:opacity-80 transition-opacity p-2">
          <Bell className="w-5 h-5 text-accent-gold" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-data-loss rounded-full border-2 border-bg-surface" />
        </div>

        {/* User Info */}
        <div className="flex items-center space-x-3 cursor-pointer group pl-4 border-l border-white/10">
          <div className="text-right">
            <p className="text-[12px] font-medium text-text-primary group-hover:text-accent-gold transition-colors">
              {isPending ? "Loading..." : session?.user?.name || "Elite Hunter"}
            </p>
            <p className="text-[10px] text-text-secondary">
              {(session?.user as any)?.role === "admin" ? "Founder" : "Elite Member"}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full border border-accent-gold/30 p-0.5 overflow-hidden transition-all group-hover:border-accent-gold hover:scale-105 bg-bg-elevated flex items-center justify-center">
            {session?.user?.image ? (
              <img 
                src={session.user.image} 
                alt="Profile" 
                className="w-full h-full object-cover rounded-full"
              />
            ) : isPending ? (
              <Loader2 className="w-4 h-4 text-accent-gold animate-spin" />
            ) : (
              <User className="text-accent-gold w-5 h-5" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
