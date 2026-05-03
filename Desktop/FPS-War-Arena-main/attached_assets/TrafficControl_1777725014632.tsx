import { useState, useCallback } from "react";
import { sinyal } from "@/lib/jarvis";

type LightColor = "green" | "red" | "yellow" | "off";

const INTERSECTIONS = [
  { id: 1, label: "Kavşak A1", x: 20, y: 25 },
  { id: 2, label: "Kavşak B3", x: 50, y: 15 },
  { id: 3, label: "Kavşak C2", x: 80, y: 30 },
  { id: 4, label: "Kavşak D4", x: 35, y: 60 },
  { id: 5, label: "Kavşak E1", x: 65, y: 55 },
  { id: 6, label: "Kavşak F5", x: 20, y: 80 },
  { id: 7, label: "Kavşak G2", x: 50, y: 75 },
  { id: 8, label: "Kavşak H8", x: 80, y: 70 },
];

const LIGHT_COLORS: Record<LightColor, string> = {
  green:  "hsl(120, 100%, 45%)",
  red:    "hsl(0, 100%, 50%)",
  yellow: "hsl(45, 100%, 50%)",
  off:    "hsl(0, 0%, 25%)",
};

const CYCLE: LightColor[] = ["green", "red", "yellow"];

const TrafficControl = () => {
  const [lights, setLights] = useState<Record<number, LightColor>>(
    Object.fromEntries(INTERSECTIONS.map((i) => [i.id, "green"]))
  );

  const toggleLight = useCallback((id: number) => {
    setLights((prev) => {
      const current = prev[id];
      const nextIdx = (CYCLE.indexOf(current) + 1) % CYCLE.length;
      return { ...prev, [id]: CYCLE[nextIdx] };
    });
  }, []);

  const killAll = useCallback(() => {
    setLights(Object.fromEntries(INTERSECTIONS.map((i) => [i.id, "off" as LightColor])));
    sinyal("trafik_kilitle");  // ← JARVIS: "Kavşaklar kilitlendi Efendim"
  }, []);

  const releaseAll = useCallback(() => {
    setLights(Object.fromEntries(INTERSECTIONS.map((i) => [i.id, "green" as LightColor])));
    sinyal("trafik_serbest");  // ← JARVIS: "Trafik akışı normale döndü"
  }, []);

  return (
    <div className="glass-panel p-4">
      <h2 className="text-primary cyber-glow text-sm font-bold mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
        ▶ TRAFİK & ŞEHİR AĞI KONTROLÜ
      </h2>
      <div className="relative w-full aspect-[2/1] bg-background/50 rounded border border-border/30 mb-3">
        {/* Grid çizgileri */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-muted-foreground/20" />
        <div className="absolute top-0 bottom-0 left-1/3 w-px bg-muted-foreground/20" />
        <div className="absolute top-0 bottom-0 left-2/3 w-px bg-muted-foreground/20" />
        <div className="absolute top-1/3 left-0 right-0 h-px bg-muted-foreground/20" />
        <div className="absolute top-2/3 left-0 right-0 h-px bg-muted-foreground/20" />

        {INTERSECTIONS.map((int) => (
          <button
            key={int.id}
            className="absolute flex flex-col items-center cursor-pointer group"
            style={{ left: `${int.x}%`, top: `${int.y}%`, transform: "translate(-50%, -50%)" }}
            onClick={() => toggleLight(int.id)}
          >
            <div
              className="w-4 h-4 rounded-full transition-all duration-300"
              style={{
                backgroundColor: LIGHT_COLORS[lights[int.id]],
                boxShadow: lights[int.id] !== "off"
                  ? `0 0 12px ${LIGHT_COLORS[lights[int.id]]}, 0 0 24px ${LIGHT_COLORS[lights[int.id]]}40`
                  : "none",
              }}
            />
            <span className="text-[8px] text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {int.label}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="cyber-btn-red w-full text-xs"
          data-sinyal="trafik_kilitle"
          onClick={killAll}
        >
          ⚠ TÜM IŞIKLARI KAPAT
        </button>
        <button
          className="cyber-btn w-full text-xs"
          data-sinyal="trafik_serbest"
          onClick={releaseAll}
        >
          ✓ IŞIKLARI SERBEST BIRAK
        </button>
      </div>
    </div>
  );
};

export default TrafficControl;
