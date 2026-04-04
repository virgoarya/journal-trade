"use client";

import { useState, useEffect } from "react";
import { Strategy } from "@/services/playbook.service";
import { playbookService } from "@/services/playbook.service";

interface CreatePlaybookFormProps {
  onSubmit?: (playbook: Strategy) => void;
  onCancel?: () => void;
  initialData?: Partial<Strategy>;
  mode?: "create" | "edit";
  compact?: boolean; // Untuk modal assignment, compact mode bisa diaktifkan nanti
}

export function CreatePlaybookForm({
  onSubmit,
  onCancel,
  initialData,
  mode = "create",
  compact = false
}: CreatePlaybookFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    methodology: "ICT" as "ICT" | "CRT" | "MSNR" | "SMC" | "PA" | "IND" | "HYBRID",
    marketCondition: "ALL" as "TRENDING" | "RANGING" | "VOLATILE" | "LIQUID" | "ALL",
    timeframe: "",
    markets: "",
    rules: "",
    htfKeyLevel: "",
    ictPoi: "" as "OrderBlock" | "FVG" | "Breaker" | "Rejection" | "iFVG" | "",
    msnrLevel: "" as "APEX" | "QM" | "OCL" | "TrendLine" | "SBR" | "RBS" | "",
    htfTimeframe: "",
    entryTimeframe: "",
    entryChecklist: [] as string[],
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
        methodology: initialData.methodology || "ICT",
        marketCondition: initialData.marketCondition || "ALL",
        timeframe: initialData.timeframe || "",
        markets: initialData.markets?.join(', ') || "",
        rules: initialData.rules?.join('\n') || "",
        htfKeyLevel: initialData.htfKeyLevel || "",
        ictPoi: initialData.ictPoi || "",
        msnrLevel: initialData.msnrLevel || "",
        htfTimeframe: initialData.htfTimeframe || "",
        entryTimeframe: initialData.entryTimeframe || "",
        entryChecklist: initialData.entryChecklist || [],
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      description: formData.description || undefined,
      methodology: formData.methodology,
      marketCondition: formData.marketCondition,
      timeframe: formData.timeframe,
      markets: formData.markets.split(',').map(m => m.trim()).filter(m => m),
      rules: formData.rules.split('\n').filter(r => r.trim()),
      htfKeyLevel: formData.htfKeyLevel || undefined,
      ictPoi: formData.ictPoi || undefined,
      msnrLevel: formData.msnrLevel || undefined,
      htfTimeframe: formData.htfTimeframe || undefined,
      entryTimeframe: formData.entryTimeframe || undefined,
      entryChecklist: formData.entryChecklist,
      ...(mode === 'create' ? { tags: [] } : {}),
    };

    try {
      setLoading(true);
      let result;
      if (mode === "edit" && initialData?.id) {
        result = await playbookService.update(initialData.id, payload);
      } else {
        result = await playbookService.create(payload);
      }

      if (result.success && result.data && onSubmit) {
        onSubmit(result.data);
      } else {
        alert(result.error || `Failed to ${mode} playbook`);
      }
    } catch (err: any) {
      alert(err.message || `An error occurred while ${mode === 'edit' ? 'updating' : 'creating'} playbook`);
    } finally {
      setLoading(false);
    }
  };

  const handleEntryChecklistChange = (item: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      entryChecklist: checked
        ? [...prev.entryChecklist, item]
        : prev.entryChecklist.filter(i => i !== item)
    }));
  };

  // If compact mode (for assignment modal), render a simplified version
  if (compact) {
    // For now, still render full form but can be adjusted later
    // Could be a modal-within-modal that's smaller
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
            Strategy Name *
          </label>
          <input
            name="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="ex: London Breakout"
            required
            className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
            Methodology *
          </label>
          <select
            name="methodology"
            value={formData.methodology}
            onChange={(e) => setFormData(prev => ({ ...prev, methodology: e.target.value as any }))}
            required
            className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
          >
            <option value="ICT">ICT</option>
            <option value="CRT">CRT</option>
            <option value="MSNR">MSNR</option>
            <option value="SMC">SMC</option>
            <option value="PA">Price Action</option>
            <option value="IND">Indicator-based</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
            Market Condition
          </label>
          <select
            name="marketCondition"
            value={formData.marketCondition}
            onChange={(e) => setFormData(prev => ({ ...prev, marketCondition: e.target.value as any }))}
            className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
          >
            <option value="ALL">All Conditions</option>
            <option value="TRENDING">Trending</option>
            <option value="RANGING">Ranging</option>
            <option value="VOLATILE">Volatile</option>
            <option value="LIQUID">High Liquidity</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
            Timeframe *
          </label>
          <input
            name="timeframe"
            type="text"
            value={formData.timeframe}
            onChange={(e) => setFormData(prev => ({ ...prev, timeframe: e.target.value }))}
            placeholder="ex: M15, H1"
            required
            className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
            Markets (comma separated) *
          </label>
          <input
            name="markets"
            type="text"
            value={formData.markets}
            onChange={(e) => setFormData(prev => ({ ...prev, markets: e.target.value }))}
            placeholder="ex: EURUSD, GBPUSD"
            required
            className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
          />
        </div>
      </div>

      {/* HTF / Market Context Section */}
      <div className="pt-4 border-t border-white/5 space-y-4">
        <h3 className="text-[11px] font-bold text-accent-gold uppercase tracking-[0.2em]">Market Context (HTF)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">HTF Timeframe</label>
            <input
              name="htfTimeframe"
              type="text"
              value={formData.htfTimeframe}
              onChange={(e) => setFormData(prev => ({ ...prev, htfTimeframe: e.target.value }))}
              placeholder="Daily / H4"
              className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">HTF Key Level</label>
            <input
              name="htfKeyLevel"
              type="text"
              value={formData.htfKeyLevel}
              onChange={(e) => setFormData(prev => ({ ...prev, htfKeyLevel: e.target.value }))}
              placeholder="e.g. 1.1200"
              className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">ICT POI</label>
            <select
              name="ictPoi"
              value={formData.ictPoi}
              onChange={(e) => setFormData(prev => ({ ...prev, ictPoi: e.target.value as any }))}
              className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
            >
              <option value="">Select POI</option>
              <option value="OrderBlock">Order Block</option>
              <option value="FVG">FVG</option>
              <option value="Breaker">Breaker Block</option>
              <option value="Rejection">Rejection Block</option>
              <option value="iFVG">iFVG</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">MSNR Level</label>
            <select
              name="msnrLevel"
              value={formData.msnrLevel}
              onChange={(e) => setFormData(prev => ({ ...prev, msnrLevel: e.target.value as any }))}
              className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
            >
              <option value="">Select Level</option>
              <option value="APEX">APEX</option>
              <option value="QM">QM</option>
              <option value="OCL">OCL</option>
              <option value="TrendLine">TrendLine</option>
              <option value="SBR">SBR</option>
              <option value="RBS">RBS</option>
            </select>
          </div>
        </div>
      </div>

      {/* Execution Setup Section */}
      <div className="pt-4 border-t border-white/5 space-y-4">
        <h3 className="text-[11px] font-bold text-accent-gold uppercase tracking-[0.2em]">Execution Setup</h3>
        <div>
          <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Confirmation Timeframe (LTF)</label>
          <input
            name="entryTimeframe"
            type="text"
            value={formData.entryTimeframe}
            onChange={(e) => setFormData(prev => ({ ...prev, entryTimeframe: e.target.value }))}
            placeholder="m1 / m5 / m15"
            className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Entry Checklist</label>
          <div className="grid grid-cols-2 gap-3">
            {["TS", "CISD", "PDA inverse", "SMT div"].map(item => (
              <label key={item} className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.entryChecklist.includes(item)}
                  onChange={(e) => handleEntryChecklistChange(item, e.target.checked)}
                  className="w-4 h-4 rounded border-border-subtle bg-bg-void text-accent-gold focus:ring-accent-gold/50"
                />
                <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">{item}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Description</label>
        <textarea
          name="description"
          rows={2}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of your strategy"
          className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none resize-none"
        />
      </div>

      {/* Rules */}
      <div>
        <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Entry Rules (one per line) *</label>
        <textarea
          name="rules"
          rows={4}
          value={formData.rules}
          onChange={(e) => setFormData(prev => ({ ...prev, rules: e.target.value }))}
          placeholder="1. Identify...&#10;2. Wait for...&#10;3. Enter when..."
          required
          className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold outline-none resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-white/5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="btn-gold disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center space-x-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span>{mode === "edit" ? "Updating..." : "Creating..."}</span>
            </span>
          ) : (
            <span>{mode === "edit" ? "Update Strategy" : "Create Strategy"}</span>
          )}
        </button>
      </div>
    </form>
  );
}
