import { useEffect } from "react";
import { THEME } from "@/lib/theme";
import { diag } from "@/debug/diag";

export default function HeroSplashMatch() {
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
          minHeight: "72vh",
        }}
      >
        {/* Oversized headline, same crop logic as loader */}
        <div
          className="absolute select-none pointer-events-none"
          style={{ left: "min(5vw, 40px)", top: "-8vh" }}
        >
          <h1
            style={{
              fontFamily: THEME.font,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 0.78,
              fontSize: "clamp(8rem, 22vw, 28rem)",
            }}
          >
            Julie
            <br />
            Camus
          </h1>
        </div>

        {/* Right column text block */}
        <div
          className="absolute"
          style={{
            right: "min(6vw, 60px)",
            top: "18vh",
            width: "min(520px, 42vw)",
            fontFamily: THEME.font,
            fontSize: "clamp(14px, 1.1vw, 16px)",
            lineHeight: 1.65,
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>MAKEUP ARTIST</p>
          <p>
            Specializing in editorial, fashion and artistic makeup. Paris, Milan, New York — crafting
            clean, modern looks with a cinematic edge.
          </p>
        </div>
      </section>

      {/* Reveal animation */}
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
      `}</style>
    </>
  );
}
