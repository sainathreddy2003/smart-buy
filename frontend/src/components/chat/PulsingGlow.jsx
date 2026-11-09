import { useState } from "react";
import { motion } from "framer-motion";
import { PulsingBorder } from "@paper-design/shaders-react";

export function PulsingGlow({ active = false }) {
  const [hasWebGL] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const canvas = document.createElement("canvas");
      return !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  });

  return (
    <motion.div
      className="absolute w-full h-full z-0 flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: 0.8 }}
    >
      {hasWebGL ? (
        <PulsingBorder
          style={{ height: "146.5%", minWidth: "143%" }}
          colorBack="hsl(0, 0%, 0%)"
          roundness={0.18}
          thickness={0}
          softness={0}
          intensity={0.3}
          bloom={2}
          spots={2}
          spotSize={0.25}
          pulse={0}
          smoke={0.35}
          smokeSize={0.4}
          scale={0.7}
          rotation={0}
          offsetX={0}
          offsetY={0}
          speed={1}
          colors={[
            "hsl(29, 70%, 37%)",
            "hsl(32, 100%, 83%)",
            "hsl(4, 32%, 30%)",
            "hsl(25, 60%, 50%)",
            "hsl(0, 100%, 10%)",
          ]}
        />
      ) : (
        <div
          className="absolute -inset-2 rounded-2xl opacity-40 blur-lg transition-opacity duration-700"
          style={{
            background:
              "radial-gradient(circle, rgba(186, 148, 101, 0.4) 0%, rgba(200, 100, 40, 0.2) 60%, transparent 80%)",
          }}
        />
      )}
    </motion.div>
  );
}
