"use client";
import { useEffect, useRef, useState } from "react";
import { diag } from "@/debug/diag";

export default function LoaderScreen({
  minDuration = 900,
  bg = "#F4F0E9",
  fg = "#0D0D0D",
}: {
  minDuration?: number;
  bg?: string;
  fg?: string;
}) {
  const [visible, setVisible] = useState(true);
  const start = useRef<number>(Date.now());

  useEffect(() => {
    const ts = start.current;
    diag("MANIFEST", "loader_screen_shown", { ts });
    console.log("[HARD-DIAG:MANIFEST]", "loader_screen_shown", { ts });

    const t = setTimeout(() => {
      const durationMs = Date.now() - start.current;
      document.body.classList.add("loader-done");
      setVisible(false);
      diag("MANIFEST", "loader_screen_hidden", { durationMs });
      console.log("[HARD-DIAG:MANIFEST]", "loader_screen_hidden", { durationMs });
    }, minDuration);

    return () => clearTimeout(t);
  }, [minDuration]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Loading Julie Camus"
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ backgroundColor: bg, color: fg }}
    >
      {/* Oversized Headline (cropped like the reference) */}
      <div
        className="absolute select-none pointer-events-none"
        style={{ 
          left: "min(5vw, 40px)", 
          top: "-8vh",
          fontSize: "clamp(8rem, 22vw, 28rem)",
          lineHeight: 0.78,
          letterSpacing: "-0.02em",
          fontWeight: 900,
          fontFamily: '"Helvetica Neue LT Std", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
        <h1>
          Julie
          <br />
          Camus
        </h1>
      </div>

      {/* Right column lorem list */}
      <div
        className="absolute"
        style={{
          right: "min(6vw, 60px)",
          top: "18vh",
          width: "min(520px, 42vw)",
          fontSize: "clamp(14px, 1.1vw, 16px)",
          lineHeight: 1.65,
          fontFamily: '"Helvetica Neue LT Std", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>ABOUT JULIE</p>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <p>
            With over 20 years of experience in fashion and beauty, Julie is a highly skilled makeup artist renowned for her refined technique and meticulous attention to detail. Her signature style blends flawless, imperceptible natural looks with a sophisticated creative vision.
          </p>
          <p>
            Trusted by some of the most prestigious luxury brands, she has consistently delivered impeccable results for the most demanding clients. Throughout her career, she has worked alongside celebrated industry figures such as Lucia Pica, former Global Creative Director for Chanel, and Peter Philips, Creative and Image Director of Dior Makeup, with whom she has collaborated for over 15 years.
          </p>
        </div>
      </div>
    </div>
  );
}
