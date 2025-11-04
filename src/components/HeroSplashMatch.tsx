import { useEffect, useRef, useState } from "react";
import { THEME } from "@/lib/theme";
import { diag } from "@/debug/diag";
import { useIsMobile } from "@/hooks/use-mobile";

export default function HeroSplashMatch() {
  const [y, setY] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const raf = useRef<number | null>(null);
  const lastLogRef = useRef(0);
  const isMobile = useIsMobile();
  
  // Detect dev UI for bottom padding safety
  const devUI = import.meta.env.DEV || new URLSearchParams(location.search).get('debug') === '1';

  // Collapse on first interaction
  useEffect(() => {
    const collapse = (reason: string) => { 
      if (!collapsed) { 
        setCollapsed(true); 
        console.log("[HARD-DIAG:HERO]", "hero_collapsed", { reason });
        diag("MANIFEST", "hero_collapsed", { reason });
      } 
    };
    
    if (window.scrollY > 0) collapse("at_load_scrollY>0");
    
    const onWheel = () => collapse("wheel");
    const onScroll = () => collapse("scroll");
    const onTouch = () => collapse("touch");
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown","PageDown"," ","Spacebar","End"].includes(e.key)) collapse("keydown");
    };
    
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("keydown", onKey);
    
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("keydown", onKey);
    };
  }, [collapsed]);

  useEffect(() => {
    const onScroll = () => {
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        setY(window.scrollY || 0);
        raf.current = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Height and fade calculations
  const baseH = isMobile ? 0.24 : 0.62;  // 24vh mobile, 62vh desktop
  const hVH = baseH * 100;
  const fade = collapsed ? 0.1 : (1 - Math.min(y / 100, 0.2)); // subtle fade on scroll

  useEffect(() => {
    // Log throttled to avoid spam (every ~120px)
    if (Math.abs(y - lastLogRef.current) > 120) {
      lastLogRef.current = y;
      diag("MANIFEST", "hero_scroll_state", { y, collapsed });
      console.log("[HARD-DIAG:HERO]", "hero_scroll_state", { y, collapsed });
    }
  }, [y, collapsed]);

  useEffect(() => {
    diag("MANIFEST", "hero_theme_synced", { bg: THEME.bg, fg: THEME.fg });
    console.log("[HARD-DIAG:THEME]", "hero_theme_synced", { bg: THEME.bg, fg: THEME.fg });
  }, []);

  return (
    <>
      <section
        id="hero"
        className="relative overflow-hidden"
        style={{
          background: THEME.bg,
          color: THEME.fg,
          height: collapsed ? '0px' : `${hVH}vh`,
          minHeight: collapsed ? 0 : (isMobile ? 0 : 200),
          paddingBottom: devUI ? 64 : 0,
          transition: "height 120ms ease-out, opacity 160ms ease-out",
          opacity: fade,
        }}
      >
        {/* 3-line pyramid headline */}
        <div
          className="absolute select-none pointer-events-none"
          style={{
            left: "clamp(8px, 5vw, 40px)",
            top: isMobile ? "14px" : "clamp(12px, 8vh, 80px)",
            lineHeight: 0.78,
            letterSpacing: "-0.02em",
            fontFamily: THEME.font,
            fontWeight: 900,
            fontSize: "clamp(3rem, 16vw, 18rem)",
            maxWidth: "90vw",
            zIndex: 2,
          }}
        >
          <div>Julie</div>
          <div style={{ marginLeft: "8vw" }}>Camus</div>
          <div style={{ marginLeft: "20vw" }}>Makeup</div>
        </div>

        {/* Right-side descriptive copy */}
        <div
          className="absolute right-col"
          style={{
            right: "min(6vw, 60px)",
            top: "clamp(12vh, 18vh, 26vh)",
            width: "min(420px, 34vw)",
            fontFamily: THEME.font,
            fontSize: "clamp(14px, 1.05vw, 16px)",
            lineHeight: 1.65,
            zIndex: 3,
            transition: collapsed ? "none" : "transform 260ms ease-out, opacity 260ms ease-out",
            transform: collapsed ? "none" : `translateY(${Math.min(24, y / 20)}px)`,
            opacity: collapsed ? 0 : Math.max(0.15, fade),
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: "0.75rem", letterSpacing: "0.02em" }}>
            MAKEUP ARTIST
          </p>
          <p>
            Specializing in editorial, fashion, and artistic makeup — crafting clean, modern looks
            with a cinematic edge across Paris, Milan, and New York.
          </p>
        </div>

        {/* Soft gradient at bottom to hand off into grid */}
        <div
          aria-hidden
          className="pointer-events-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 48,
            background: "linear-gradient(to bottom, rgba(244,240,233,0), rgba(244,240,233,1))",
          }}
        />
      </section>

      {/* Reveal animation + hide right column on small screens */}
      <style>{`
        #hero { 
          opacity: 0; 
          transform: translateY(6px); 
          transition: opacity 280ms ease, transform 360ms ease; 
        }
        body.loader-done #hero { 
          opacity: 1; 
          transform: translateY(0); 
        }
        @media (max-width: 1280px) {
          #hero .right-col { display: none; }
        }
      `}</style>
    </>
  );
}
