"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  PenLine,
  BookOpen,
  BarChart3,
  Bot,
  Settings,
  LogOut
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { useSession } from "@/lib/auth-client";
import { AccountSwitcher } from "./account-switcher";

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const mainNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Log Trade", href: "/log-trade", icon: PenLine },
  { name: "Playbook", href: "/playbook", icon: BookOpen },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "AI Review", href: "/ai-review", icon: Bot },
];

const utilityNav = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Logout", href: "/logout", icon: LogOut },
];

interface SidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get initials for profile placeholder
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const sidebarClasses = cn(
    "h-screen sticky left-0 top-0 glass-sidebar flex flex-col justify-between py-6 z-50",
    isMobile
      ? "fixed w-[260px] shadow-2xl transition-transform duration-300"
      : "w-[260px]"
  );

  const closeButtonVisible = isMobile;

  return (
    <aside className={sidebarClasses}>
      {/* Mobile Close Button */}
      {closeButtonVisible && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-full glass-nav-item hover:bg-white/10 transition-colors touch-target"
          aria-label="Close menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div>
        {/* Brand Logo */}
        <div className="mx-4 mb-8 px-4 py-3 flex items-center space-x-3 glass cursor-pointer transition-all hover:scale-[1.02]">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-accent-gold/10 rounded-full" style={{ animation: 'glowBreath 3s ease-in-out infinite' }} />
            <img src="/logo.png" alt="Hunter Trades Logo" className="relative w-[48px] h-[48px] object-contain" style={{ animation: 'logoPulse 3s ease-in-out infinite' }} />
          </div>
          <div>
            <h1 className="text-[14px] font-bold text-accent-gold tracking-[0.1em] leading-tight">
              HUNTER TRADES
            </h1>
            <p className="text-[8px] text-text-secondary tracking-[0.25em] mt-0.5 uppercase font-semibold">
              Elite Ledger
            </p>
          </div>
        </div>

        {/* Global Account Context Switcher */}
        <div className="px-3 mb-4">
          <AccountSwitcher />
        </div>

        {/* Main Navigation */}
        <nav className="space-y-2 px-3">
          {mainNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={isMobile ? onClose : undefined}
                className={cn(
                  "flex items-center h-[44px] sm:h-[48px] px-3 group touch-target",
                  isActive
                    ? "text-accent-gold glass-nav-active"
                    : "text-text-secondary hover:text-accent-gold glass-nav-item"
                )}
              >
                <item.icon className={cn(
                  "mr-3 sm:mr-4 w-5 h-5 flex-shrink-0",
                  isActive ? "text-accent-gold" : "text-text-secondary group-hover:text-accent-gold"
                )} />
                <span className={cn(
                  "font-sans font-medium tracking-wide",
                  "text-xs sm:text-[13px]",
                  isActive ? "font-bold" : ""
                )}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Navigation */}
      <div className="space-y-2 px-3">
        <div className="border-t border-white/5 mx-2 pt-6 mb-4" />
        {utilityNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={isMobile ? onClose : undefined}
            className="flex items-center h-[44px] sm:h-[48px] px-3 text-text-secondary hover:text-accent-gold group glass-nav-item touch-target"
          >
            <item.icon className="mr-3 sm:mr-4 w-5 h-5 flex-shrink-0 group-hover:text-accent-gold" />
            <span className="font-sans font-medium text-xs sm:text-[13px] tracking-wide">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
