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
        className="absolute select-none pointer-events-none font-archivo-black"
        style={{ 
          left: "min(5vw, 40px)", 
          top: "-8vh",
          fontSize: "clamp(8rem, 22vw, 28rem)",
          lineHeight: 0.78,
          letterSpacing: "-0.02em",
          fontWeight: 900,
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
        className="absolute font-inter"
        style={{
          right: "min(6vw, 60px)",
          top: "18vh",
          width: "min(520px, 42vw)",
          fontSize: "clamp(14px, 1.1vw, 16px)",
          lineHeight: 1.65,
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: "0.75rem" }}>LOREM IPSUM</p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li>Lorem ipsum dolor sit amet</li>
          <li>Consectetur adipiscing elit</li>
          <li>Sed do eiusmod tempor incididunt</li>
          <li>Ut labore et dolore magna aliqua</li>
          <li>Quis nostrud exercitation ullamco</li>
          <li>Laboris nisi ut aliquip ex ea commodo</li>
          <li>Duis aute irure dolor in reprehenderit</li>
          <li>In voluptate velit esse cillum dolore</li>
          <li>Eu fugiat nulla pariatur</li>
        </ul>

        <p style={{ fontWeight: 600, marginTop: "2rem", marginBottom: "0.75rem" }}>
          DOLOR SIT
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          <li>Excepteur sint occaecat cupidatat</li>
          <li>Non proident, sunt in culpa</li>
          <li>Qui officia deserunt mollit anim</li>
        </ul>
      </div>
    </div>
  );
}
