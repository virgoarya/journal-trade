import { useState, useEffect } from "react";
import { 
  ListCheck, 
  X, 
  Zap, 
  CheckCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { playbookService } from "@/services/playbook.service";
import { toast } from "sonner";

interface ChecklistModalProps {
  playbookId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChecklistModal({ playbookId, isOpen, onClose }: ChecklistModalProps) {
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [playbookName, setPlaybookName] = useState("");

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const response = await playbookService.getById(playbookId);
      if (response.success && response.data) {
        setChecklist(response.data.entryChecklist || []);
        setPlaybookName(response.data.name);
      }
    } catch (error) {
      console.error("Failed to fetch checklist:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && playbookId) {
      fetchChecklist();
    }
  }, [isOpen, playbookId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-bg-void border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-text-primary mb-1">
            Review: {playbookName}
          </h2>
          <p className="text-sm text-text-secondary">
            Pastikan semua item checklist terpenuhi sebelum entry
          </p>
        </div>
        
        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto min-h-[100px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
            </div>
          ) : (
            <>
              {checklist.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors">
                  <ListCheck className="w-5 h-5 text-accent-gold shrink-0 mt-0.5" />
                  <span className="text-sm text-text-primary leading-relaxed">{item}</span>
                </div>
              ))}
              {checklist.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-text-secondary">Tidak ada checklist items untuk strategi ini.</p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-white/5 bg-white/[0.01] rounded-b-2xl flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors text-sm font-semibold"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
          
          <button 
            onClick={() => {
              toast.success("Checklist reviewed!");
              onClose();
            }}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent-gold text-bg-void font-bold hover:brightness-110 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Ready to Trade</span>
          </button>
        </div>
        
      </div>
    </div>
  );
}