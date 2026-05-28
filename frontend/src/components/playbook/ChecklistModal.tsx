import { useState } from "react";
import { Button } from "@/components/ui";
import { 
  Checklist, 
  X, 
  Zap, 
  CheckCircle,
  AlertCircle 
} from "lucide-react";
import { Card, CardContent, CardHeader, Divider } from "@/components/ui";

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
    if (isOpen) {
      fetchChecklist();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-bg-void border border-white/10 rounded-2xl shadow-2xl">
        <CardHeader 
          title={`Review: ${playbookName}`}
          description="Pastikan semua item checklist terpenuhi sebelum entry"
        />
        <Divider />
        <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
            </div>
          ) : (
            <>
              {checklist.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5">
                  <Checklist className="w-5 h-5 text-accent-gold mt-0.5" />
                  <span className="text-sm text-text-primary">{item}</span>
                </div>
              ))}
              {checklist.length === 0 && (
                <p className="text-sm text-text-secondary text-center">Tidak ada checklist items</p>
              )}
            </>
          )}
        </CardContent>
        <Divider />
        <div className="flex justify-end gap-2 p-4 bg-bg-void/80 rounded-b-xl">
          <Button 
            variant="outline" 
            onClick={onClose}
            startIcon={<X className="w-4 h-4" />}
          >
            Close
          </Button>
          <Button 
            onClick={() => {
              toast.success("Checklist reviewed!");
              onClose();
            }}
            startIcon={<CheckCircle className="w-4 h-4" />}
          >
            Ready to Trade
          </Button>
        </div>
      </Card>
    </div>
  );
}