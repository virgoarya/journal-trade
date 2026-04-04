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

export function Sidebar() {
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

  return (
    <aside className="w-[260px] h-screen sticky left-0 top-0 bg-bg-surface flex flex-col justify-between py-6 border-r border-white/5">
      <div>
        {/* Brand Logo */}
        <div className="px-8 mb-10 flex items-center space-x-3">
          <img src="/logo.png" alt="Hunter Trades Logo" className="w-10 h-auto object-contain" />
          <div>
            <h1 className="text-[16px] font-bold text-accent-gold tracking-[0.15em] leading-none">
              HUNTER TRADES
            </h1>
            <p className="text-[10px] text-text-secondary tracking-[0.2em] mt-1 uppercase">
              Elite Ledger
            </p>
          </div>
        </div>

        {/* Global Account Context Switcher */}
        <AccountSwitcher />

        {/* Main Navigation */}
        <nav className="space-y-1">
          {mainNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center h-[48px] px-4 transition-all duration-200 group border-l-[3px]",
                  isActive 
                    ? "text-accent-gold bg-accent-gold/5 border-accent-gold" 
                    : "text-text-secondary hover:text-accent-gold hover:bg-white/5 border-transparent"
                )}
              >
                <item.icon className={cn(
                  "mr-4 w-6 h-6",
                  isActive ? "text-accent-gold" : "text-text-secondary group-hover:text-accent-gold"
                )} />
                <span className={cn(
                  "font-sans font-medium text-[14px] tracking-wide",
                  isActive ? "font-semibold" : ""
                )}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Navigation */}
      <div className="space-y-1">
        <div className="border-t border-white/5 mx-4 pt-6 mb-4" />
        {utilityNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center h-[48px] text-text-secondary hover:text-accent-gold px-4 hover:bg-white/5 transition-colors duration-200 group"
          >
            <item.icon className="mr-4 w-6 h-6 group-hover:text-accent-gold" />
            <span className="font-sans font-medium text-[14px] tracking-wide">
              {item.name}
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
