import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { playbookService, type Strategy } from "@/services/playbook.service";
import { PlaybookCard } from "@/components/playbook/PlaybookCard";
import { CreatePlaybookForm } from "@/components/playbook/CreatePlaybookForm";
import { Plus, Zap, Trophy, Target } from "lucide-react";

export default function PlaybooksPage() {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Strategy | null>(null);

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const fetchPlaybooks = async () => {
    setLoading(true);
    const response = await playbookService.getAll();
    if (response.success && Array.isArray(response.data)) {
      setPlaybooks(response.data);
    }
    setLoading(false);
  };

  const handleCreate = () => {
    setShowCreateForm(true);
  };

  const handleEdit = (playbook: Strategy) => {
    setEditingPlaybook(playbook);
  };

  const handleFormSubmit = (playbook: Strategy) => {
    toast.success("Playbook berhasil disimpan!");
    setShowCreateForm(false);
    setEditingPlaybook(null);
    fetchPlaybooks();
  };

  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingPlaybook(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus playbook ini?")) {
      const response = await playbookService.delete(id);
      if (response.success) {
        toast.success("Playbook berhasil dihapus");
        fetchPlaybooks();
      } else {
        toast.error("Gagal menghapus playbook");
      }
    }
  };

  const handleArchive = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin mengarsipkan playbook ini?")) {
      const response = await playbookService.archive(id);
      if (response.success) {
        toast.success("Playbook berhasil diarsipkan");
        fetchPlaybooks();
      } else {
        toast.error("Gagal mengarsipkan playbook");
      }
    }
  };

  const handleDuplicate = async (id: string) => {
    const response = await playbookService.duplicate(id);
    if (response.success) {
      toast.success("Playbook berhasil diduplikasi");
      fetchPlaybooks();
    } else {
      toast.error("Gagal menduplikasi playbook");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-accent-gold border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-accent-gold font-mono text-sm tracking-widest animate-pulse">LOADING...</p>
        </div>
      </div>
    );
  }

  if (showCreateForm || editingPlaybook) {
    return (
      <div className="max-w-4xl mx-auto">
        <CreatePlaybookForm
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          initialData={editingPlaybook || undefined}
          mode={editingPlaybook ? "edit" : "create"}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Trading Playbooks</h1>
          <p className="text-text-secondary text-sm mt-1">Kelola strategi trading Anda dengan checklist entry yang terstruktur</p>
        </div>
        <button
          onClick={handleCreate}
          className="btn-gold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create Playbook</span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-accent-gold" />
            <div>
              <p className="text-2xl font-bold text-accent-gold">{playbooks.length}</p>
              <p className="text-sm text-text-secondary">Total Strategies</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-accent-gold" />
            <div>
              <p className="text-2xl font-bold text-accent-gold">
                {playbooks.reduce((sum, pb) => sum + pb.stats.totalTrades, 0)}
              </p>
              <p className="text-sm text-text-secondary">Total Trades</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 text-accent-gold" />
            <div>
              <p className="text-2xl font-bold text-accent-gold">
                {playbooks.length > 0
                  ? (playbooks.reduce((sum, pb) => sum + pb.stats.winRate, 0) / playbooks.length).toFixed(1)
                  : "0"
                }%
              </p>
              <p className="text-sm text-text-secondary">Avg Win Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Playbook Grid */}
      {playbooks.length === 0 ? (
        <div className="text-center py-16">
          <Zap className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <h3 className="text-xl font-bold text-text-primary mb-2">Belum ada Playbook</h3>
          <p className="text-text-secondary mb-6">Buat playbook pertama Anda untuk memulai trading yang terstruktur</p>
          <button
            onClick={handleCreate}
            className="btn-gold"
          >
            Create Your First Playbook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playbooks.map((playbook) => (
            <PlaybookCard
              key={playbook.id}
              playbook={playbook}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  );
}