import { useState } from "react";
import { LiquidMetal } from "@paper-design/shaders-react";

export function LiquidOrb({
  size = 80,
  speed = 5,
  colorTint = "hsl(29, 77%, 49%)",
  className = "",
  showDots = true,
}) {
  const [hasWebGL] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const canvas = document.createElement("canvas");
      return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  });

  const scale = size / 80;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Overlay specular micro-dots for glass reflection */}
      {showDots && (
        <div
          className="z-10 absolute bg-white/5 rounded-full backdrop-blur-[3px] pointer-events-none"
          style={{
            width: Math.round(44 * scale),
            height: Math.round(44 * scale),
          }}
        >
          <div
            className="bg-white rounded-full absolute blur-[1px]"
            style={{ width: 2, height: 2, top: 16 * scale, left: 16 * scale }}
          />
          <div
            className="bg-white rounded-full absolute blur-[0.8px]"
            style={{ width: 2, height: 2, top: 12 * scale, left: 28 * scale }}
          />
          <div
            className="bg-white rounded-full absolute blur-[1px]"
            style={{ width: 2, height: 2, top: 32 * scale, left: 8 * scale }}
          />
          <div
            className="bg-white rounded-full absolute blur-[0.8px]"
            style={{ width: 2, height: 2, top: 20 * scale, left: 36 * scale }}
          />
          <div
            className="bg-white rounded-full absolute blur-[1px]"
            style={{ width: 2, height: 2, top: 28 * scale, left: 28 * scale }}
          />
        </div>
      )}

      {hasWebGL ? (
        <>
          {/* Blurred outer glow shader */}
          <LiquidMetal
            style={{
              height: size,
              width: size,
              filter: "blur(14px)",
              position: "absolute",
              pointerEvents: "none",
            }}
            colorBack="hsl(0, 0%, 0%, 0)"
            colorTint={colorTint}
            repetition={4}
            softness={0.5}
            shiftRed={0.3}
            shiftBlue={0.3}
            distortion={0.1}
            contour={1}
            shape="circle"
            offsetX={0}
            offsetY={0}
            scale={0.58}
            rotation={50}
            speed={speed}
          />
          {/* Crisp foreground shader */}
          <LiquidMetal
            style={{
              height: size,
              width: size,
              position: "relative",
              pointerEvents: "none",
            }}
            colorBack="hsl(0, 0%, 0%, 0)"
            colorTint={colorTint}
            repetition={4}
            softness={0.5}
            shiftRed={0.3}
            shiftBlue={0.3}
            distortion={0.1}
            contour={1}
            shape="circle"
            offsetX={0}
            offsetY={0}
            scale={0.58}
            rotation={50}
            speed={speed}
          />
        </>
      ) : (
        /* CSS fallback if WebGL is disabled or unavailable */
        <div
          className="rounded-full animate-pulse"
          style={{
            width: size * 0.7,
            height: size * 0.7,
            background: "radial-gradient(circle, #e28437 0%, #b8541a 50%, #4a1c04 100%)",
            boxShadow: "0 0 25px rgba(226, 132, 55, 0.6)",
          }}
        />
      )}
    </div>
  );
}
