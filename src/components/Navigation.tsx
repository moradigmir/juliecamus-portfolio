import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Volume2, VolumeX, Play, PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '@/lib/theme';
import { diag } from '@/debug/diag';
import { useVideoSettings } from '@/hooks/useVideoSettings';
import { Switch } from '@/components/ui/switch';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { autoplayEnabled, muteEnabled, setAutoplayEnabled, setMuteEnabled } = useVideoSettings();
  
  const variant = useMemo(() => location.pathname === '/' ? 'home' : 'default', [location.pathname]);

  useEffect(() => {
    diag("MANIFEST", "nav_variant_selected", { variant, path: location.pathname });
    console.log("[HARD-DIAG:NAV]", "nav_variant_selected", { variant, path: location.pathname });
  }, [variant, location.pathname]);

  const navigation = [
    { name: 'Portfolio', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav 
      className="fixed z-50"
      style={{
        top: variant === 'home' ? 'env(safe-area-inset-top, 0px)' : 0,
        left: variant === 'home' ? 'auto' : 0,
        right: variant === 'home' ? 'min(4vw, 28px)' : 0,
        background: variant === 'home' ? 'transparent' : THEME.bg,
        borderBottom: variant === 'home' ? 'none' : "1px solid rgba(0,0,0,0.06)",
        backdropFilter: variant === 'home' ? 'none' : "saturate(140%) blur(4px)",
      }}
    >
      <div className="mx-auto flex items-center" style={{ 
        maxWidth: variant === 'home' ? 'none' : 1280, 
        padding: variant === 'home' ? "14px 0" : "14px min(4vw, 28px)",
        justifyContent: variant === 'home' ? 'flex-end' : 'space-between'
      }}>
        {variant === 'default' && (
          <Link 
            to="/" 
            className="select-none hover:opacity-80 transition-opacity"
            aria-label="Julie Camus – Home"
            style={{
              fontFamily: THEME.font,
              fontWeight: 900,
              letterSpacing: "-0.01em",
              fontSize: "clamp(18px, 2.1vw, 28px)",
              lineHeight: 1,
              color: THEME.fg,
            }}
          >
            Julie&nbsp;Camus
          </Link>
        )}

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="hover:opacity-80 transition-opacity relative"
              style={{
                fontFamily: THEME.font,
                fontSize: "clamp(13px, 1vw, 15px)",
                letterSpacing: "0.02em",
                color: THEME.fg,
                textDecoration: "none",
              }}
            >
              {item.name}
              {isActive(item.href) && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-1 left-0 right-0 h-0.5"
                  style={{ backgroundColor: THEME.fg }}
                />
              )}
            </Link>
          ))}
          
          {/* Video Settings */}
          {location.pathname === '/' && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoplayEnabled(!autoplayEnabled)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                  style={{
                    fontFamily: THEME.font,
                    fontSize: "clamp(12px, 0.9vw, 13px)",
                    letterSpacing: "0.02em",
                    color: THEME.fg,
                  }}
                  title={autoplayEnabled ? "Disable autoplay" : "Enable autoplay"}
                >
                  <PlayCircle size={14} />
                  <Switch checked={autoplayEnabled} onCheckedChange={setAutoplayEnabled} />
                </button>
                
                <button
                  onClick={() => setMuteEnabled(!muteEnabled)}
                  className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                  style={{
                    fontFamily: THEME.font,
                    fontSize: "clamp(12px, 0.9vw, 13px)",
                    letterSpacing: "0.02em",
                    color: THEME.fg,
                  }}
                  title={muteEnabled ? "Unmute videos" : "Mute videos"}
                >
                  {muteEnabled ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  <Switch checked={muteEnabled} onCheckedChange={setMuteEnabled} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 hover:opacity-80 transition-opacity"
          style={{ color: THEME.fg }}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden"
            style={{
              background: THEME.bg,
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div className="px-4 py-2 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block py-2 hover:opacity-80 transition-opacity"
                  style={{
                    fontFamily: THEME.font,
                    fontSize: "15px",
                    letterSpacing: "0.02em",
                    color: isActive(item.href) ? THEME.fg : `${THEME.fg}CC`,
                    fontWeight: isActive(item.href) ? 600 : 400,
                  }}
                >
                  {item.name}
                </Link>
              ))}
              
              {/* Video Settings for Mobile */}
              {location.pathname === '/' && (
                <>
                  <div className="h-px bg-border my-2" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2" style={{ fontFamily: THEME.font, fontSize: "14px", color: THEME.fg }}>
                        <PlayCircle size={16} />
                        <span>Autoplay</span>
                      </div>
                      <Switch checked={autoplayEnabled} onCheckedChange={setAutoplayEnabled} />
                    </div>
                    
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2" style={{ fontFamily: THEME.font, fontSize: "14px", color: THEME.fg }}>
                        {muteEnabled ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        <span>Mute</span>
                      </div>
                      <Switch checked={muteEnabled} onCheckedChange={setMuteEnabled} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navigation;