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

  const heroRef = useRef<HTMLElement | null>(null);
  const headlineRef = useRef<HTMLDivElement | null>(null);
  const rightColRef = useRef<HTMLDivElement | null>(null);

  // /?diagnostics=1 shows dev tools
  const devUI =
    typeof window !== "undefined" &&
    window.location.pathname === "/" &&
    new URLSearchParams(window.location.search).get("diagnostics") === "1";

  // Read --dev-toolbar-h CSS variable for /?diagnostics
  const [toolbarH, setToolbarH] = useState(0);
  useEffect(() => {
    const updateToolbarH = () => {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue("--dev-toolbar-h")
        .trim();
      const px = parseInt(val) || 0;
      setToolbarH(px);
    };
    updateToolbarH();
    const obs = new MutationObserver(updateToolbarH);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });
    return () => obs.disconnect();
  }, []);

  // MOBILE: keep tight measured height (already present)
  const [mobileHeroH, setMobileHeroH] = useState(0);
  useEffect(() => {
    if (!isMobile) return;
    const el = headlineRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.getBoundingClientRect().height || 0;
      // cushion 20px to ensure descenders (like "p") are fully visible
      setMobileHeroH(Math.ceil(h + 20));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isMobile]);

  // DESKTOP: measure real content height (headline + right column)
  const [desktopHeroH, setDesktopHeroH] = useState<number | null>(null);
  useEffect(() => {
    if (isMobile) return;
    const measureDesktop = () => {
      const heroEl = heroRef.current;
      const headEl = headlineRef.current;
      if (!heroEl || !headEl) return;
      
      // Proportional gradient: clamp(8px, 3vh, 28px) on desktop
      const vh = Math.max(320, window.innerHeight || 0);
      const grad = Math.round(
        Math.min(Math.max(vh * 0.03, 8), 28)
      );
      
      const headRect = headEl.getBoundingClientRect();
      // Proportional cushion: max(4px, 4% of headline height)
      const cushion = Math.max(4, Math.round(headRect.height * 0.04));

      const computedTop = parseFloat(
        getComputedStyle(headEl).top || "0"
      );

      // headline bottom relative to hero top
      const heroTop = heroEl.getBoundingClientRect().top;
      const headlineBottom = computedTop + headRect.height;

      // right column bottom relative to hero top (if present)
      let rightBottom = 0;
      if (rightColRef.current) {
        const r = rightColRef.current.getBoundingClientRect();
        rightBottom = r.bottom - heroTop;
      }

      const maxBottom = Math.max(headlineBottom, rightBottom);
      const devPad = devUI ? toolbarH : 0;
      const next = Math.ceil(maxBottom + grad + cushion + devPad);
      setDesktopHeroH(next);
    };

    // initial + on resize + on headline/right resize + when fonts settle
    const headEl = headlineRef.current;
    const rightEl = rightColRef.current;
    const ro1 = headEl ? new ResizeObserver(measureDesktop) : null;
    const ro2 = rightEl ? new ResizeObserver(measureDesktop) : null;
    if (ro1 && headEl) ro1.observe(headEl);
    if (ro2 && rightEl) ro2.observe(rightEl);

    measureDesktop();
    window.addEventListener("resize", measureDesktop);
    // fonts ready (optional, safe in modern browsers)
    if (document?.fonts?.ready) {
      document.fonts.ready.then(measureDesktop).catch(() => {});
    }
    return () => {
      window.removeEventListener("resize", measureDesktop);
      ro1?.disconnect();
      ro2?.disconnect();
    };
  }, [isMobile, devUI, toolbarH]);

  // Collapse on first interaction (keep behavior)
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
      if (["ArrowDown", "PageDown", " ", "Spacebar", "End"].includes(e.key))
        collapse("keydown");
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

  // track scroll (for fade only)
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

  // Reset hero when scrolling back to top
  useEffect(() => {
    if (y === 0 && collapsed) {
      setCollapsed(false);
      console.log("[HARD-DIAG:HERO]", "hero_reset", { reason: "scrolled_to_top" });
      diag("MANIFEST", "hero_reset", { reason: "scrolled_to_top" });
    }
  }, [y, collapsed]);

  // subtle fade on scroll (kept)
  const fade = collapsed ? 0 : 1 - Math.min(y / 100, 0.2);

  useEffect(() => {
    if (Math.abs(y - lastLogRef.current) > 120) {
      lastLogRef.current = y;
      diag("MANIFEST", "hero_scroll_state", { y, collapsed });
      console.log("[HARD-DIAG:HERO]", "hero_scroll_state", { y, collapsed });
    }
  }, [y, collapsed]);

  useEffect(() => {
    diag("MANIFEST", "hero_theme_synced", { bg: THEME.bg, fg: THEME.fg });
    console.log("[HARD-DIAG:THEME]", "hero_theme_synced", {
      bg: THEME.bg,
      fg: THEME.fg,
    });
  }, []);

  // Final hero height selection
  const heroH = collapsed
    ? 0
    : isMobile
    ? mobileHeroH
    : desktopHeroH ?? Math.round(Math.max(window.innerHeight * 0.48, 360));

  return (
    <>
      <section
        id="hero"
        ref={heroRef}
        className="relative overflow-hidden"
        style={{
          background: THEME.bg,
          color: THEME.fg,
          height: heroH,
          minHeight: collapsed ? 0 : "auto",
          transition: "height 260ms ease-out",
          opacity: fade,
        }}
      >
        {/* 3-line pyramid headline (keep visual offsets and clamps) */}
        <div
          ref={headlineRef}
          className="absolute select-none pointer-events-none"
          style={{
            left: "clamp(8px, 5vw, 40px)",
            top: isMobile ? "max(env(safe-area-inset-top, 0px), 8px)" : "clamp(12px, 8vh, 80px)",
            lineHeight: 0.78,
            letterSpacing: "-0.02em",
            fontFamily: THEME.font,
            fontWeight: 900,
            fontSize: isMobile ? "clamp(2.5rem, 14vw, 16rem)" : "clamp(3rem, 16vw, 18rem)",
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
          ref={rightColRef}
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
            height: isMobile ? "min(16px, max(6px, 2vh))" : "min(28px, max(8px, 3vh))",
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
