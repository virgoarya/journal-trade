"use client";

import { useEffect, useState } from "react";
import { tradingAccountService, TradingAccount } from "@/services/trading-account.service";
import { ChevronDown, Briefcase } from "lucide-react";

export function AccountSwitcher() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<TradingAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await tradingAccountService.getAll();
        if (res.success && res.data) {
          setAccounts(res.data);
          const active = res.data.find(a => a.isActive);
          if (active) setActiveAccount(active);
        }
      } catch (error) {
        console.error("Failed to fetch accounts", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const handleSwitchAccount = async (accountId: string) => {
    if (activeAccount?.id === accountId) return;
    
    setIsLoading(true);
    try {
      const res = await tradingAccountService.setActive(accountId);
      if (res.success && res.data) {
        setActiveAccount(res.data);
        // Force reload to naturally reset the entire dashboard context for the new active account
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to switch account", error);
      setIsLoading(false);
    }
  };

  if (isLoading || accounts.length === 0) {
    return (
      <div className="px-6 mb-6 mt-4">
        <div className="h-[42px] w-full bg-white/5 animate-pulse rounded-lg border border-white/5"></div>
      </div>
    );
  }

  return (
    <div className="px-6 mb-6 mt-2 relative group">
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Briefcase className="w-4 h-4 text-accent-gold opacity-80" />
        </div>
        <select
          value={activeAccount?.id || ""}
          onChange={(e) => handleSwitchAccount(e.target.value)}
          disabled={isLoading}
          className="w-full appearance-none bg-bg-void/40 border border-white/10 hover:border-accent-gold/40 rounded-lg py-2.5 pl-10 pr-8 text-[13px] font-medium text-text-primary focus:outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all duration-200 cursor-pointer shadow-sm"
        >
          {accounts.map(acc => (
            <option key={acc.id} value={acc.id} className="bg-bg-surface text-text-primary py-2">
              {acc.accountName} {acc.broker ? `(${acc.broker})` : ''}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
          <ChevronDown className="w-4 h-4 text-text-secondary group-hover:text-accent-gold transition-colors" />
        </div>
      </div>
    </div>
  );
}
