"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { playbookService, type Strategy } from "@/services/playbook.service";
import { CreatePlaybookForm } from "@/components/playbook/CreatePlaybookForm";
import { ChevronLeft, AlertCircle } from "lucide-react";

function PlaybookFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [loading, setLoading] = useState(true);
  const [playbook, setPlaybook] = useState<Strategy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchPlaybook(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchPlaybook = async (id: string) => {
    const response = await playbookService.getById(id);
    if (response.success && response.data) {
      setPlaybook(response.data);
      setLoading(false);
    } else {
      setError("Gagal memuat playbook");
      setLoading(false);
    }
  };

  const handleSubmit = (playbook: Strategy) => {
    toast.success("Playbook berhasil disimpan!");
    router.push('/playbooks');
  };

  const handleCancel = () => {
    router.push('/playbooks');
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

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-data-loss mx-auto mb-4" />
          <p className="text-data-loss font-bold text-lg mb-2">Error</p>
          <p className="text-sm text-text-secondary mb-6">{error}</p>
          <button
            onClick={() => router.push('/playbooks')}
            className="px-6 py-2 bg-bg-void text-accent-gold border border-accent-gold/20 hover:border-accent-gold rounded-lg font-bold uppercase text-xs tracking-widest"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex justify-between items-center">
        <button
          onClick={() => router.push('/playbooks')}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">Kembali ke Playbooks</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <CreatePlaybookForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          initialData={playbook || undefined}
          mode={playbook ? "edit" : "create"}
        />
      </div>
    </div>
  );
}

export default function PlaybookFormPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-accent-gold border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-accent-gold font-mono text-sm tracking-widest animate-pulse">LOADING...</p>
        </div>
      </div>
    }>
      <PlaybookFormContent />
    </Suspense>
  );
}