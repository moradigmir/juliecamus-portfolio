import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { checkProjectHealth } from '@/lib/projectHealth';

interface ProjectStatusIndicatorProps {
  onRetry?: () => void;
  compact?: boolean;
}

const ProjectStatusIndicator = ({ onRetry, compact = false }: ProjectStatusIndicatorProps) => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [health, setHealth] = useState<{
    isHealthy: boolean;
    isSupabasePaused: boolean;
    error?: string;
    details?: string;
  } | null>(null);

  const performHealthCheck = async () => {
    setIsChecking(true);
    try {
      const result = await checkProjectHealth();
      setHealth(result);
      setLastCheck(new Date());
    } catch (error) {
      setHealth({
        isHealthy: false,
        isSupabasePaused: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Initial health check
    performHealthCheck();
  }, []);

  if (!health && !isChecking) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {isChecking ? (
          <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : health?.isHealthy ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-500" />
        )}
        <span className="text-muted-foreground">
          {isChecking ? 'Checking...' : health?.isHealthy ? 'Services OK' : 'Service Issue'}
        </span>
      </div>
    );
  }

  // Don't show full card if everything is healthy
  if (health?.isHealthy && !isChecking) {
    return null;
  }

  return (
    <Card className="border-destructive bg-destructive/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {isChecking ? (
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <AlertCircle className="w-5 h-5 text-destructive" />
            )}
          </div>
          
          <div className="flex-1">
            <div className="font-semibold text-destructive mb-1">
              {isChecking ? 'Checking Project Status...' : 
               health?.isSupabasePaused ? 'Supabase Project Paused' : 
               'Service Unavailable'}
            </div>
            
            {!isChecking && (
              <>
                <div className="text-sm text-muted-foreground mb-3">
                  {health?.isSupabasePaused ? (
                    <>
                      Your Supabase project appears to be paused. This means the backend services 
                      (including the HiDrive proxy) are temporarily unavailable.
                    </>
                  ) : (
                    <>
                      Unable to connect to backend services. {health?.error}
                    </>
                  )}
                </div>
                
                {health?.details && (
                  <div className="text-xs text-muted-foreground mb-3 font-mono bg-muted p-2 rounded">
                    {health.details}
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={performHealthCheck}
                    disabled={isChecking}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Recheck Status
                  </Button>
                  
                  {onRetry && (
                    <Button size="sm" onClick={onRetry}>
                      Retry Loading
                    </Button>
                  )}
                  
                  {health?.isSupabasePaused && (
                    <Button size="sm" variant="outline" asChild>
                      <a 
                        href="https://supabase.com/dashboard/project/fvrgjyyflojdiklqepqt"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Resume Project
                      </a>
                    </Button>
                  )}
                </div>
                
                {health?.isSupabasePaused && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    <strong>To resume:</strong> Go to your Supabase dashboard, select this project, 
                    and click "Resume" if it shows as paused. This usually happens when projects 
                    are inactive for extended periods.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectStatusIndicator;