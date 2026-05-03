import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { browserControl, sinyal, urlAc, aramaYap } from "@/lib/jarvis";

// ── Hızlı erişim linkleri ──────────────────────────────────────────────
const QUICK_LINKS = [
  { label: "YouTube",   icon: "▶",  sinyal: "youtube_ac",   url: "https://youtube.com" },
  { label: "Google",    icon: "🔍", sinyal: "google_ac",    url: "https://google.com" },
  { label: "GitHub",    icon: "⚙",  sinyal: "github_ac",    url: "https://github.com" },
  { label: "Discord",   icon: "💬", sinyal: "discord_ac",   url: "https://discord.com" },
  { label: "Spotify",   icon: "🎵", sinyal: "spotify_ac",   url: "https://spotify.com" },
  { label: "WhatsApp",  icon: "📱", sinyal: "whatsapp_ac",  url: "https://web.whatsapp.com" },
  { label: "Gmail",     icon: "📧", sinyal: "gmail_ac",     url: "https://mail.google.com" },
  { label: "Wikipedia", icon: "📖", sinyal: "wikipedia_ac", url: "https://wikipedia.org" },
  { label: "Reddit",    icon: "👽", sinyal: "reddit_ac",    url: "https://reddit.com" },
];

// ── Arama motorları ────────────────────────────────────────────────────
const MOTORS = [
  { value: "google",    label: "Google" },
  { value: "youtube",   label: "YouTube" },
  { value: "github",    label: "GitHub" },
  { value: "wikipedia", label: "Wiki" },
];

type LogEntry = { time: string; text: string; ok: boolean };

const MissionControl = () => {
  // Gemini doğal dil arama
  const [search, setSearch]       = useState("");
  const [searchLog, setSearchLog] = useState<LogEntry[]>([]);
  const [searching, setSearching] = useState(false);

  // Motor araması
  const [motor, setMotor]         = useState("google");
  const [motorSorgu, setMotorSorgu] = useState("");

  function addLog(text: string, ok = true) {
    const time = new Date().toLocaleTimeString("tr-TR");
    setSearchLog((prev) => [...prev.slice(-6), { time, text, ok }]);
  }

  // ── Gemini doğal dil komutu ──────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const query = search.trim();
    if (!query) return;
    setSearching(true);
    setSearch("");
    addLog(`↗ ${query}`);
    const result = await browserControl(query);
    addLog(
      result ? "✓ JARVIS komutu işledi" : "✗ Sunucu yanıt vermedi — fallback aktif",
      !!result
    );
    setSearching(false);
  }, [search]);

  // ── Motor araması ────────────────────────────────────────────────────
  const handleMotorSearch = useCallback(async () => {
    const sorgu = motorSorgu.trim();
    if (!sorgu) return;
    setMotorSorgu("");
    addLog(`🔍 ${motor.toUpperCase()}: ${sorgu}`);
    const result = await aramaYap(motor, sorgu);
    addLog(result ? `✓ ${motor} araması başlatıldı` : `✓ Fallback ile açıldı`);
  }, [motor, motorSorgu]);

  // ── Hızlı erişim ────────────────────────────────────────────────────
  const handleQuickLink = useCallback(async (link: typeof QUICK_LINKS[0]) => {
    addLog(`⚡ ${link.label} açılıyor...`);
    const result = await urlAc(link.url, link.label);
    addLog(result ? `✓ ${link.label} yayında` : `✓ ${link.label} tarayıcıda açıldı`);
  }, []);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="cyber-btn text-[10px] md:text-xs flex items-center gap-1.5"
          style={{ animation: "pulse-glow 3s infinite" }}
        >
          <span style={{ animation: "blink 1.5s infinite" }}>◆</span>
          GÖREVLER
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="border-l glass-panel w-[340px] sm:w-[400px] p-0 overflow-y-auto"
        style={{ borderColor: "hsla(var(--cyber-green) / 0.3)" }}
      >
        <SheetHeader className="p-4 pb-2 sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/30">
          <SheetTitle
            className="text-primary cyber-glow text-sm font-bold tracking-widest"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            ▶ MISSION CONTROL
          </SheetTitle>
          <p className="text-[9px] text-muted-foreground tracking-wider">
            JARVIS-M v3.1 — BROWSER CONTROL AKTİF
          </p>
        </SheetHeader>

        <div className="p-4 space-y-5">

          {/* ── 1. GEMİNİ AKILLI ARAMA ─────────────────────────────── */}
          <section>
            <p className="section-label">🤖 GEMİNİ AKILLI ARAMA</p>
            <p className="text-[9px] text-muted-foreground/60 mb-2">
              Doğal dil yaz → Gemini yorumlar → JARVIS yapar
            </p>
            <div className="flex gap-2">
              <input
                className="cyber-input flex-1 text-[11px]"
                placeholder="YouTube'da lofi müzik ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                disabled={searching}
              />
              <button
                onClick={handleSearch}
                disabled={searching || !search.trim()}
                className="cyber-btn text-[10px] px-3 min-w-[44px]"
                data-sinyal="akilli_arama"
              >
                {searching ? "..." : "GÖN"}
              </button>
            </div>
          </section>

          {/* ── 2. MOTOR ARAMASI ───────────────────────────────────── */}
          <section>
            <p className="section-label">🔍 MOTOR ARAMASI</p>
            <div className="flex gap-2">
              <select
                className="cyber-input text-[11px] w-24 shrink-0 cursor-pointer"
                value={motor}
                onChange={(e) => setMotor(e.target.value)}
              >
                {MOTORS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <input
                className="cyber-input flex-1 text-[11px]"
                placeholder="Arama sorgusu..."
                value={motorSorgu}
                onChange={(e) => setMotorSorgu(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleMotorSearch()}
              />
              <button
                onClick={handleMotorSearch}
                disabled={!motorSorgu.trim()}
                className="cyber-btn text-[10px] px-3"
              >
                ARA
              </button>
            </div>
          </section>

          {/* ── LOG ───────────────────────────────────────────────── */}
          {searchLog.length > 0 && (
            <div
              className="bg-background/60 rounded border border-border/20 p-2 space-y-0.5 max-h-24 overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--cyber-green)) transparent" }}
            >
              {searchLog.map((l, i) => (
                <p
                  key={i}
                  className="text-[9px] font-mono"
                  style={{ color: l.ok ? "hsl(var(--cyber-green))" : "hsl(var(--cyber-red))" }}
                >
                  [{l.time}] {l.text}
                </p>
              ))}
            </div>
          )}

          {/* ── 3. HIZLI ERİŞİM ───────────────────────────────────── */}
          <section>
            <p className="section-label">⚡ HIZLI ERİŞİM</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_LINKS.map((link) => (
                <button
                  key={link.label}
                  className="cyber-btn text-[10px] py-3 flex flex-col items-center gap-1 hover:scale-105 transition-transform"
                  data-sinyal={link.sinyal}
                  onClick={() => handleQuickLink(link)}
                >
                  <span className="text-base">{link.icon}</span>
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── 4. SİSTEM KOMUTLARI ───────────────────────────────── */}
          <section>
            <p className="section-label">⚙ SİSTEM KOMUTLARI</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="cyber-btn text-[10px]"
                data-sinyal="sistem_baslat"
                onClick={() => { sinyal("sistem_baslat"); addLog("▶ Sistem başlatıldı"); }}
              >
                ▶ SİSTEM BAŞLAT
              </button>
              <button
                className="cyber-btn-red text-[10px]"
                data-sinyal="sistem_kapat"
                onClick={() => { sinyal("sistem_kapat"); addLog("■ Sistem kapatılıyor", false); }}
              >
                ■ SİSTEM KAPAT
              </button>
              <button
                className="cyber-btn text-[10px]"
                data-sinyal="vpn_baglanti"
                onClick={() => { sinyal("vpn_baglanti"); addLog("🔒 VPN aktif"); }}
              >
                🔒 VPN AÇ
              </button>
              <button
                className="cyber-btn text-[10px]"
                data-sinyal="durum_raporu"
                onClick={() => { sinyal("durum_raporu"); addLog("📊 Rapor istendi"); }}
              >
                📊 DURUM RAPORU
              </button>
              <button
                className="cyber-btn text-[10px]"
                data-sinyal="ag_tara"
                onClick={() => { sinyal("ag_tara"); addLog("📡 Ağ taranıyor"); }}
              >
                📡 AĞ TARA
              </button>
              <button
                className="cyber-btn text-[10px]"
                data-sinyal="kamera_izle"
                onClick={() => { sinyal("kamera_izle"); addLog("📷 Kamera aktif"); }}
              >
                📷 KAMERA
              </button>
            </div>
          </section>

        </div>
      </SheetContent>
    </Sheet>
  );
};

// ── Yardımcı CSS sınıfı (section başlığı) — Tailwind uyumlu ──────────
// Bu sınıfı index.css'e de ekleyebilirsin:
// .section-label { @apply text-[10px] text-muted-foreground mb-1.5 tracking-widest uppercase; }
// Şimdilik inline style ile çalışıyor.

export default MissionControl;
