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
          paddingTop: "80px",
        }}
      >
        {/* Oversized headline, adjusted positioning */}
        <div
          className="absolute select-none pointer-events-none"
          style={{ 
            left: "min(5vw, 40px)", 
            top: "calc(80px - 4vh)",
            maxWidth: "55%",
          }}
        >
          <h1
            style={{
              fontFamily: THEME.font,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 0.85,
              fontSize: "clamp(5rem, 16vw, 20rem)",
            }}
          >
            Julie
            <br />
            Camus
          </h1>
        </div>

        {/* Right column text block - adjusted positioning */}
        <div
          className="absolute"
          style={{
            right: "min(6vw, 60px)",
            top: "calc(80px + 12vh)",
            width: "min(420px, 38vw)",
            fontFamily: THEME.font,
            fontSize: "clamp(13px, 1vw, 15px)",
            lineHeight: 1.6,
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: "0.75rem", letterSpacing: "0.05em" }}>MAKEUP ARTIST</p>
          <p style={{ opacity: 0.9 }}>
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
