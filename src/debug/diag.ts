export type Diag = {
  t: number;
  tag: string;
  msg: string;
  data?: any;
};

// Initialize global diagnostics buffer
declare global {
  interface Window {
    __diag: Diag[];
    getDiag: () => Diag[];
    copyDiag: () => void;
  }
}

const RING_SIZE = 500;

if (typeof window !== 'undefined') {
  if (!window.__diag) {
    window.__diag = [];
  }

  if (!window.getDiag) {
    window.getDiag = () => [...window.__diag].reverse(); // newest first
  }

  if (!window.copyDiag) {
    window.copyDiag = () => {
      const data = JSON.stringify(window.getDiag(), null, 2);
      navigator.clipboard.writeText(data).then(() => {
        console.log('Diagnostics copied to clipboard');
      });
    };
  }
}

export const diag = (tag: string, msg: string, data?: any): void => {
  if (typeof window === 'undefined') return;

  const entry: Diag = {
    t: Date.now(),
    tag,
    msg,
    data
  };

  window.__diag.push(entry);

  // Keep ring buffer size
  if (window.__diag.length > RING_SIZE) {
    window.__diag.shift();
  }

  // Also log to console for immediate visibility
  console.log(`[DIAG:${tag}] ${msg}`, data || '');
};
