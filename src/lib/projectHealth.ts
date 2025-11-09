/**
 * Supabase health checks are obsolete now that media is served locally.
 * Export no-op helpers so existing imports remain valid while UI is cleaned up.
 */

export interface ProjectHealthResult {
  isHealthy: boolean;
  isSupabasePaused: boolean;
  error?: string;
  details?: string;
}

export const checkProjectHealth = async (): Promise<ProjectHealthResult> => ({
  isHealthy: true,
  isSupabasePaused: false,
  details: 'Supabase proxy disabled; using local media.',
});

export const detectSupabaseIssueFromResponse = (): boolean => false;