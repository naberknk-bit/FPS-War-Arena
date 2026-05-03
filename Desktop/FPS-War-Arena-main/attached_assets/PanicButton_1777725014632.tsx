import { useState, useEffect, useCallback } from "react";
import { sinyal } from "@/lib/jarvis";

const PanicButton = () => {
  const [active, setActive]       = useState(false);
  const [countdown, setCountdown] = useState(10);

  const trigger = useCallback(() => {
    setActive(true);
    setCountdown(10);
    sinyal("kk_99");   // ← JARVIS'e KK-99 sinyali gönder
  }, []);

  useEffect(() => {
    if (!active) return;
    if (countdown <= 0) {
      setTimeout(() => { setActive(false); setCountdown(10); }, 2000);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [active, countdown]);

  if (active) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "hsl(0, 0%, 2%)", animation: "glitch 0.15s infinite" }}
      >
        <div className="text-center">
          {countdown > 0 ? (
            <>
              <p
                className="text-accent text-lg font-bold mb-4 red-glow"
                style={{ fontFamily: "'Orbitron', sans-serif", animation: "blink 0.3s infinite" }}
              >
                ⚠ SİSTEM KENDİNİ İMHA EDİYOR ⚠
              </p>
              <p
                className="text-8xl font-black text-accent red-glow"
                style={{ fontFamily: "'Orbitron', sans-serif", animation: "countdownPulse 1s infinite" }}
              >
                {countdown}
              </p>
              <p className="text-muted-foreground text-xs mt-4">TÜM VERİLER SİLİNİYOR... KAÇIŞ İMKANSIZ</p>
              <button
                className="cyber-btn mt-6 text-xs"
                onClick={() => { setActive(false); setCountdown(10); sinyal("alarm_kapat"); }}
              >
                İPTAL — KODU GİR
              </button>
            </>
          ) : (
            <div>
              <p className="text-accent text-2xl font-black red-glow" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                💀 SİSTEM ÇÖKTÜ 💀
              </p>
              <p className="text-muted-foreground text-xs mt-2">Bağlantı kesildi. İyi günler, ajan.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center my-4">
      <button
        onClick={trigger}
        data-sinyal="kk_99"
        className="relative px-12 py-6 text-2xl font-black tracking-widest cursor-pointer"
        style={{
          fontFamily: "'Orbitron', sans-serif",
          background: "hsla(0, 100%, 50%, 0.15)",
          border: "3px solid hsl(0, 100%, 50%)",
          color: "hsl(0, 100%, 50%)",
          borderRadius: "var(--radius)",
          animation: "pulse-glow 2s infinite",
          textShadow: "0 0 10px hsl(0,100%,50%), 0 0 30px hsla(0,100%,50%,0.5)",
          boxShadow: "0 0 30px hsla(0,100%,50%,0.3), inset 0 0 30px hsla(0,100%,50%,0.1)",
        }}
      >
        KK-99
      </button>
    </div>
  );
};

export default PanicButton;
