import { useEffect, useRef, useState } from "react";
import { THEME } from "@/lib/theme";
import { diag } from "@/debug/diag";

export default function HeroSplashMatch() {
  const [y, setY] = useState(0);
  const raf = useRef<number | null>(null);
  const lastLogRef = useRef(0);

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

  // Collapse from baseHeight to minHeight as user scrolls
  const baseH = 0.62;  // 62vh
  const minH = 0.42;   // 42vh (never smaller)
  const dist = 700;    // px to reach min
  const t = Math.min(1, Math.max(0, y / dist)); // 0..1
  const hVH = (baseH - (baseH - minH) * t) * 100; // vh
  const fade = 1 - t * 0.9; // fade to ~0.1

  useEffect(() => {
    // Log throttled to avoid spam (every ~120px)
    if (Math.abs(y - lastLogRef.current) > 120) {
      lastLogRef.current = y;
      diag("MANIFEST", "hero_scroll_state", { y, ratio: t.toFixed(3) });
      console.log("[HARD-DIAG:HERO]", "hero_scroll_state", { y, ratio: t.toFixed(3) });
    }
  }, [y, t]);

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
          height: `${hVH}vh`,
          minHeight: 420,
          paddingTop: "64px",
          transition: "height 260ms ease-out",
          opacity: fade,
        }}
      >
        {/* 3-line pyramid headline */}
        <div
          className="absolute select-none pointer-events-none"
          style={{
            left: "min(5vw, 40px)",
            top: "calc(64px - 4vh)",
            lineHeight: 0.78,
            letterSpacing: "-0.02em",
            fontFamily: THEME.font,
            fontWeight: 900,
            fontSize: "clamp(7rem, 16vw, 18rem)",
          }}
        >
          <div>Julie</div>
          <div style={{ marginLeft: "2vw" }}>Camus</div>
          <div style={{ marginLeft: "4vw" }}>Makeup</div>
        </div>

        {/* Right-side descriptive copy */}
        <div
          className="absolute right-col"
          style={{
            right: "min(6vw, 60px)",
            top: "calc(22vh + 32px)",
            width: "min(460px, 38vw)",
            fontFamily: THEME.font,
            fontSize: "clamp(14px, 1.05vw, 16px)",
            lineHeight: 1.65,
            transition: "transform 260ms ease-out, opacity 260ms ease-out",
            transform: `translateY(${Math.min(24, y / 20)}px)`,
            opacity: Math.max(0.15, fade),
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
        @media (max-width: 900px) {
          #hero .right-col { display: none; }
        }
      `}</style>
    </>
  );
}
