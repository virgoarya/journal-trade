import { useState } from "react";
import { Plus, X } from "lucide-react";

interface EntryChecklistInputProps {
  checklist?: string[];
  onChange?: (newChecklist: string[]) => void;
}

export function EntryChecklistInput({ checklist = [], onChange }: EntryChecklistInputProps) {
  const [items, setItems] = useState<string[]>(checklist);
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (newItem.trim() && !items.includes(newItem.trim())) {
      const updatedItems = [...items, newItem.trim()];
      setItems(updatedItems);
      setNewItem("");
      onChange?.(updatedItems);
    }
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    onChange?.(updatedItems);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em]">Entry Checklist</label>
        <button
          type="button"
          onClick={addItem}
          disabled={!newItem.trim()}
          className="p-1 text-accent-gold hover:text-accent-gold/80 disabled:text-text-muted disabled:cursor-not-allowed"
          title="Add Item"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Checklist Items */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item, index) => (
            <label key={index} className="flex items-center space-x-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={false}
                readOnly
                className="w-4 h-4 rounded border-border-subtle bg-bg-void text-accent-gold focus:ring-accent-gold/50"
              />
              <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors flex-1 truncate">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-text-muted hover:text-data-loss opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove Item"
              >
                <X className="w-3 h-3" />
              </button>
            </label>
          ))}
        </div>
      )}

      {/* Add New Item Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Tambahkan item checklist (contoh: TS, PDA inverse, SMT div)"
          className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-text-primary text-sm focus:border-accent-gold outline-none"
        />
      </div>

      {items.length === 0 && (
        <p className="text-xs text-text-muted italic">
          Tambahkan item checklist yang harus diperiksa sebelum entry trading
        </p>
      )}
    </div>
  );
}