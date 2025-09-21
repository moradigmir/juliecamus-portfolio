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

export async function flushDiagToEdge(summary: any) {
  try {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(summary).slice(0, 8000))));
    // Send a NOOP request to the proxy that the edge function will log and 204
    const u = `https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?diag=1&payload=${encodeURIComponent(payload)}`;
    await fetch(u, { method: "GET", mode: "cors" });
  } catch (e) {
    console.warn("diag flush failed", e);
  }
}

export function buildDiagSummary(opts: {
  items_sorted?: string[];
  placeholders_after_real?: number;
  validate_start?: string[];
  validate_ok?: Array<{folder:string,file:string,status:number,ct:string}>;
  validate_fail?: Array<{folder:string,reason:string}>;
  validate_summary?: {folders_ok:number, folders_failed:number, total:number};
  manifest_proposed_count?: number;
  manifest_example_0?: any;
  diff_lines?: number;
  net_examples?: Array<{type:"propfind_ok"|"range_ok", path:string, status:number, ct?:string}>;
}) { 
  return { ts: Date.now(), tag: "HIDRIVE_DIAG", ...opts }; 
}
