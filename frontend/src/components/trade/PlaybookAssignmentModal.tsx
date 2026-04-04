"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Sparkles, AlertCircle } from "lucide-react";
import { playbookService, type Strategy } from "@/services/playbook.service";
import { PlaybookCard } from "@/components/playbook/PlaybookCard";
import { CreatePlaybookForm } from "@/components/playbook/CreatePlaybookForm";

interface PlaybookAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeId: string;
  onAssigned: (playbook: Strategy) => void;
  suggestedPlaybookIds?: string[];
}

export function PlaybookAssignmentModal({
  isOpen,
  onClose,
  tradeId,
  onAssigned,
  suggestedPlaybookIds = []
}: PlaybookAssignmentModalProps) {
  const [playbooks, setPlaybooks] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchPlaybooks();
      setSelectedId("");
      setShowCreateForm(false);
    }
  }, [isOpen]);

  const fetchPlaybooks = async () => {
    try {
      setLoading(true);
      const result = await playbookService.getAll();
      if (result.success && Array.isArray(result.data)) {
        const active = result.data.filter(p => !p.isArchived);
        setPlaybooks(active);
      }
    } catch (error) {
      console.error("Failed to fetch playbooks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedId) return;

    try {
      setLoading(true);
      const result = await playbookService.assignToTrade(selectedId, tradeId);
      if (result.success && result.data) {
        onAssigned(result.data);
        onClose();
      } else {
        alert(result.error || "Failed to assign playbook");
      }
    } catch (error: any) {
      alert("An error occurred while assigning playbook");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAssign = async (newPlaybook: Strategy) => {
    try {
      setLoading(true);
      const result = await playbookService.assignToTrade(newPlaybook.id, tradeId);
      if (result.success && result.data) {
        onAssigned(result.data);
        onClose();
      } else {
        alert(result.error || "Failed to assign playbook");
      }
    } catch (error: any) {
      alert("Failed to assign playbook");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const suggestedPlaybooks = playbooks.filter(p => suggestedPlaybookIds.includes(p.id || ""));
  const regularPlaybooks = playbooks.filter(p => !suggestedPlaybookIds.includes(p.id || ""));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-bg-void/80 backdrop-blur-md flex items-center justify-center z-[70] p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="glass border border-accent-gold/20 rounded-2xl max-w-5xl w-full mx-auto shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-5 bg-accent-gold/5 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-accent-gold/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent-gold" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary tracking-wide">
                  Assign to Playbook
                </h2>
                <p className="text-[10px] text-accent-gold uppercase tracking-[0.2em] font-medium">
                  Strategy Tracking
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-text-muted hover:text-accent-gold hover:bg-accent-gold/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              Link this trade to a playbook to improve strategy performance tracking.
              This helps you identify which methodologies work best in different market conditions.
            </p>

            {/* AI Suggestions */}
            {suggestedPlaybooks.length > 0 && !showCreateForm && (
              <div className="mb-8">
                <div className="flex items-center space-x-2 mb-4">
                  <Sparkles className="w-4 h-4 text-accent-gold" />
                  <h3 className="text-sm font-semibold text-accent-gold">AI Suggested Matches</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {suggestedPlaybooks.map((playbook) => (
                    <PlaybookCard
                      key={playbook.id || (playbook as any)._id}
                      playbook={playbook}
                      isSelectable={true}
                      isSelected={selectedId === playbook.id}
                      onSelect={(p) => setSelectedId(p.id || "")}
                      showActions={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            {suggestedPlaybooks.length > 0 && regularPlaybooks.length > 0 && !showCreateForm && (
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-text-muted">Or select from all playbooks</span>
                </div>
              </div>
            )}

            {/* All Playbooks */}
            {!showCreateForm && (
              <>
                {regularPlaybooks.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {regularPlaybooks.map((playbook) => (
                      <PlaybookCard
                        key={playbook.id || (playbook as any)._id}
                        playbook={playbook}
                        isSelectable={true}
                        isSelected={selectedId === playbook.id}
                        onSelect={(p) => setSelectedId(p.id || "")}
                        showActions={false}
                      />
                    ))}
                  </div>
                ) : (
                  !loading && playbooks.length === 0 && (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-50" />
                      <p className="text-text-secondary">No playbooks yet</p>
                      <p className="text-[10px] text-text-muted mt-1">
                        Create your first playbook to start tracking strategy performance
                      </p>
                    </div>
                  )
                )}

                {/* Create New Playbook Button */}
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full p-4 rounded-xl border-2 border-dashed border-white/10 hover:border-accent-gold/50 transition-all flex items-center justify-center space-x-2 text-text-secondary hover:text-accent-gold"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">Create New Playbook</span>
                </button>
              </>
            )}

            {/* Create Form View */}
            {showCreateForm && (
              <div className="py-4">
                <CreatePlaybookForm
                  onSubmit={handleCreateAndAssign}
                  onCancel={() => setShowCreateForm(false)}
                  mode="create"
                />
              </div>
            )}

            {/* Loading Overlay */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Footer - Only show when not in create form */}
          {!showCreateForm && (
            <div className="px-6 py-4 bg-bg-void/30 border-t border-white/5 flex justify-between items-center flex-shrink-0">
              <button
                onClick={onClose}
                className="text-sm text-text-secondary hover:text-white transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedId || loading}
                className="px-6 py-2 bg-accent-gold text-bg-void rounded-lg font-bold text-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Assign to Selected
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
