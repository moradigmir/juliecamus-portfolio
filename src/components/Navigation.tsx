import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { THEME } from '@/lib/theme';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

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
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: THEME.bg,
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        backdropFilter: "saturate(140%) blur(4px)",
      }}
    >
      <div className="mx-auto flex items-center justify-between" style={{ maxWidth: 1280, padding: "14px min(4vw, 28px)" }}>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navigation;