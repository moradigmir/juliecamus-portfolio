interface ProjectHealthResult {
  isHealthy: boolean;
  isSupabasePaused: boolean;
  error?: string;
  details?: string;
}

export const checkProjectHealth = async (): Promise<ProjectHealthResult> => {
  try {
    // Test edge function with a simple request
    const testUrl = 'https://fvrgjyyflojdiklqepqt.functions.supabase.co/hidrive-proxy?path=/test-health-check';
    
    const response = await fetch(testUrl, { 
      method: 'HEAD',
      // Add a timeout to prevent hanging
      signal: AbortSignal.timeout(10000)
    });
    
    const contentType = response.headers.get('content-type') || '';
    
    // Detect Supabase project pause signals
    const isSupabasePaused = (
      response.status === 404 && 
      contentType.includes('text/html')
    );
    
    if (isSupabasePaused) {
      return {
        isHealthy: false,
        isSupabasePaused: true,
        error: 'Supabase project appears to be paused',
        details: 'Edge function returning HTML error page instead of expected response'
      };
    }
    
    // Even if we get 404 for the test path, if it's not HTML, the proxy is working
    const isHealthy = response.status !== 404 || !contentType.includes('text/html');
    
    return {
      isHealthy,
      isSupabasePaused: false,
      error: isHealthy ? undefined : `Edge function returned ${response.status}`,
      details: `Status: ${response.status}, Content-Type: ${contentType}`
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Network errors or timeouts could indicate Supabase issues
    const isPossiblyPaused = errorMessage.includes('timeout') || 
                            errorMessage.includes('network') ||
                            errorMessage.includes('fetch');
    
    return {
      isHealthy: false,
      isSupabasePaused: isPossiblyPaused,
      error: errorMessage,
      details: 'Failed to connect to edge function'
    };
  }
};

export const detectSupabaseIssueFromResponse = (
  status: number, 
  contentType: string, 
  responseText?: string
): boolean => {
  // Primary indicator: HTML content when expecting media
  if (status === 404 && contentType.includes('text/html')) {
    return true;
  }
  
  // Secondary indicators in response text
  if (responseText) {
    const text = responseText.toLowerCase();
    return text.includes('supabase') && 
           (text.includes('paused') || text.includes('inactive') || text.includes('suspended'));
  }
  
  return false;
};