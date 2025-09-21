import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Trash2 } from 'lucide-react';
import type { Diag } from './diag';

interface DiagnosticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiagnosticsModal({ open, onOpenChange }: DiagnosticsModalProps) {
  const [entries, setEntries] = useState<Diag[]>([]);

  const refreshEntries = () => {
    if (typeof window !== 'undefined' && window.getDiag) {
      setEntries(window.getDiag().slice(0, 300)); // Show last 300, newest first
    }
  };

  const copyDiag = () => {
    if (typeof window !== 'undefined' && window.copyDiag) {
      window.copyDiag();
    }
  };

  const clearDiag = () => {
    if (typeof window !== 'undefined' && window.__diag) {
      window.__diag.length = 0;
      setEntries([]);
    }
  };

  useEffect(() => {
    if (open) {
      refreshEntries();
      const interval = setInterval(refreshEntries, 1000);
      return () => clearInterval(interval);
    }
  }, [open]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toTimeString().slice(0, 8);
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'ORDER': return 'text-blue-600 bg-blue-50';
      case 'VALIDATE': return 'text-green-600 bg-green-50';
      case 'PERSIST': return 'text-purple-600 bg-purple-50';
      case 'NET': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>HiDrive Diagnostics ({entries.length})</span>
            <div className="flex gap-2">
              <Button onClick={copyDiag} variant="outline" size="sm">
                <Copy className="w-3 h-3 mr-1" />
                Copy JSON
              </Button>
              <Button onClick={clearDiag} variant="outline" size="sm">
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="overflow-auto max-h-[60vh] space-y-1 font-mono text-xs">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No diagnostics entries yet. Try using "Check Folders" or "Write to manifest".
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 border rounded bg-gray-50">
                <span className="text-gray-400 w-16 shrink-0">
                  {formatTime(entry.t)}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold w-20 text-center shrink-0 ${getTagColor(entry.tag)}`}>
                  {entry.tag}
                </span>
                <span className="font-medium w-32 shrink-0">
                  {entry.msg}
                </span>
                <span className="text-gray-600 flex-1 break-all">
                  {entry.data ? JSON.stringify(entry.data) : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}