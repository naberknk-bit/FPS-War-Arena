import { useEffect, useState, useCallback, useRef } from "react";
import { Socket } from "socket.io-client";

interface PlayerInfo {
  socketId: string; username: string; isFounder: boolean;
  roomId: string | null; hp: number; money: number;
  position: { x: number; y: number; z: number };
}

type Tab = "players" | "commands" | "server" | "moderation";
type BanDuration = "chat" | "game-hour" | "day" | "year";

interface AdminPanelProps { socket: Socket; isOpen: boolean; onClose: () => void; }

const CMD_HELP = [
  { cmd: "/ban <kullanıcı> [sebep]",   desc: "Oyuncuyu banla ve at" },
  { cmd: "/event <mesaj>",             desc: "Tüm oyunculara özel etkinlik duyurusu" },
  { cmd: "/givemoney <miktar>",        desc: "Tüm oyunculara para ver" },
  { cmd: "/broadcast <mesaj>",        desc: "Sunucu geneli kırmızı duyuru" },
  { cmd: "/map <astral|canyon|frost|ruins|mars|volcano|space|egypt|cyberpunk|underwater>", desc: "Tüm odaların haritasını değiştir" },
  { cmd: "/fly <socketId>",           desc: "Uçuş modunu toggle et" },
  { cmd: "/god <socketId>",           desc: "God modunu toggle et" },
  { cmd: "/tp <socketId>",            desc: "Oyuncuyu başlangıca ışınla" },
  { cmd: "/hp <socketId> <değer>",    desc: "HP ayarla" },
  { cmd: "/kill <socketId>",          desc: "Oyuncuyu öldür" },
  { cmd: "/ban <kullanıcı> [chat|hour|day|year] [sebep]", desc: "Kademeli ban uygula" },
];

const QUICK_EVENTS = [
  { label: "⚔️ 2X XP",  msg: "🔥 2X XP ETKİNLİĞİ BAŞLADI! Tüm öldürmeler 2 kat XP veriyor!", money: 0 },
  { label: "💰 Para Yağmuru", msg: "💰 PARA YAĞMURU! Tüm oyunculara $1500 yatırıldı!", money: 1500 },
  { label: "🏆 Turnuva", msg: "🏆 BÜYÜK TURNUVA BAŞLIYOR! En iyi 5 oyuncu ödül kazanır!", money: 0 },
  { label: "🚀 Hız Modu", msg: "🚀 HIZLANMA ETKİNLİĞİ! 5 dakika boyunca turbo mod!", money: 0 },
  { label: "👑 Kurucu Günü", msg: "👑 KURUCU GÜNÜ! Muhammed Ali sunucuda! Saygı gösterin!", money: 500 },
];

export default function AdminPanel({ socket, isOpen, onClose }: AdminPanelProps) {
  const [players, setPlayers]     = useState<PlayerInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback]   = useState("");
  const [tab, setTab]             = useState<Tab>("players");
  const [cmdInput, setCmdInput]   = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [banDuration, setBanDuration] = useState<BanDuration>("chat");
  const [banReason, setBanReason] = useState("");
  const [cmdHistory, setCmdHistory] = useState<{ cmd: string; result: string; ok: boolean }[]>([]);
  const cmdHistoryEndRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => { socket.emit("admin_get_players"); }, [socket]);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    const interval = setInterval(refresh, 3000);
    const handler = (list: PlayerInfo[]) => setPlayers(list);
    socket.on("admin_players_list", handler);
    return () => { clearInterval(interval); socket.off("admin_players_list", handler); };
  }, [isOpen, socket, refresh]);

  useEffect(() => {
    cmdHistoryEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cmdHistory]);

  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(""), 2500); };

  const addResult = (cmd: string, result: string, ok: boolean) =>
    setCmdHistory(prev => [...prev.slice(-24), { cmd, result, ok }]);

  const exec = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("/")) { addResult(raw, "Komutlar / ile başlamalı", false); return; }
    const parts = trimmed.slice(1).split(" ");
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);

    switch (cmd) {
      case "ban": {
        const uname = args[0]; const reason = args.slice(1).join(" ") || "Admin kararı";
        if (!uname) { addResult(trimmed, "Kullanım: /ban <kullanıcı> [sebep]", false); break; }
        socket.emit("admin_ban", { username: uname, reason, duration: banDuration });
        addResult(trimmed, `✓ ${uname} banlandı (${banDuration}). Sebep: ${reason}`, true); break;
      }
      case "event": {
        if (!args.length) { addResult(trimmed, "Kullanım: /event <mesaj>", false); break; }
        socket.emit("admin_event", { message: args.join(" ") });
        addResult(trimmed, `✓ Etkinlik duyurusu gönderildi`, true); break;
      }
      case "givemoney": {
        const amt = parseInt(args[0]);
        if (isNaN(amt)) { addResult(trimmed, "Kullanım: /givemoney <miktar>", false); break; }
        socket.emit("admin_giveall", { money: amt });
        addResult(trimmed, `✓ Tüm oyunculara $${amt} verildi`, true); break;
      }
      case "broadcast": {
        if (!args.length) { addResult(trimmed, "Kullanım: /broadcast <mesaj>", false); break; }
        socket.emit("admin_broadcast", { message: args.join(" ") });
        addResult(trimmed, `✓ Duyuru yayınlandı`, true); break;
      }
      case "map": {
        const maps = ["astral","canyon","frost","ruins","mars","volcano","space","egypt","cyberpunk","underwater"];
        if (!maps.includes(args[0])) { addResult(trimmed, `Geçerli haritalar: ${maps.join(", ")}`, false); break; }
        socket.emit("admin_force_map", { map: args[0] });
        addResult(trimmed, `✓ Harita değiştiriliyor: ${args[0]}`, true); break;
      }
      case "fly": {
        const tid = args[0] || selectedId;
        if (!tid) { addResult(trimmed, "Kullanım: /fly <socketId> (veya oyuncu seçin)", false); break; }
        socket.emit("admin_fly", { targetId: tid });
        addResult(trimmed, `✓ Uçuş modu toggle: ${tid}`, true); break;
      }
      case "god": {
        const tid = args[0] || selectedId;
        if (!tid) { addResult(trimmed, "Kullanım: /god <socketId> (veya oyuncu seçin)", false); break; }
        socket.emit("admin_god", { targetId: tid });
        addResult(trimmed, `✓ God modu toggle: ${tid}`, true); break;
      }
      case "tp": {
        const tid = args[0] || selectedId;
        if (!tid) { addResult(trimmed, "Kullanım: /tp <socketId> (veya oyuncu seçin)", false); break; }
        socket.emit("admin_teleport", { targetId: tid, x: 0, y: 1.65, z: 0 });
        addResult(trimmed, `✓ Oyuncu başlangıca taşındı`, true); break;
      }
      case "hp": {
        const tid = args[0]; const hp = parseInt(args[1]);
        if (!tid || isNaN(hp)) { addResult(trimmed, "Kullanım: /hp <socketId> <değer>", false); break; }
        socket.emit("admin_set_hp", { targetId: tid, hp });
        addResult(trimmed, `✓ ${tid} HP → ${hp}`, true); break;
      }
      case "kill": {
        const tid = args[0] || selectedId;
        if (!tid) { addResult(trimmed, "Kullanım: /kill <socketId>", false); break; }
        socket.emit("admin_set_hp", { targetId: tid, hp: 0 });
        addResult(trimmed, `✓ Oyuncu öldürüldü`, true); break;
      }
      default:
        addResult(trimmed, `Bilinmeyen komut: /${cmd} — /help için komutlar listesine bakın`, false);
    }
    setCmdInput("");
  }, [socket, selectedId]);

  if (!isOpen) return null;
  const selected = players.find(p => p.socketId === selectedId);

  return (
    <div className="admin-panel-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-panel godmode">
        <div className="admin-panel-header">
          <span className="admin-panel-title">⚡ TANRI MODU — KURUCU KONTROLÜ</span>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            {feedback && <span className="admin-feedback">{feedback}</span>}
            <span className="admin-player-count">{players.length} oyuncu</span>
            <button className="admin-refresh-btn" onClick={refresh} title="Yenile">↻</button>
            <button className="admin-close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="admin-tabs">
        {(["players","commands","server","moderation"] as Tab[]).map(t => (
            <button key={t} className={`admin-tab${tab===t?" active":""}`} onClick={() => setTab(t)}>
              {t==="players"?"👥 Oyuncular":t==="commands"?"⌨️ Komutlar":t==="server"?"🌐 Sunucu":"🛡️ Moderasyon"}
            </button>
          ))}
        </div>

        {/* ── PLAYERS TAB ─────────────────────────────────────────────── */}
        {tab === "players" && (
          <div className="admin-panel-body">
            <div className="admin-player-list">
              <div className="admin-section-title">BAĞLI OYUNCULAR ({players.length})</div>
              {players.length === 0 && <div className="admin-empty">Bağlı oyuncu yok</div>}
              {players.map(p => (
                <div key={p.socketId}
                  className={`admin-player-row${selectedId===p.socketId?" active":""}`}
                  onClick={() => setSelectedId(p.socketId)}
                >
                  <div className="admin-player-name">
                    {p.isFounder && <span style={{color:"#ffcc44"}}>⚡ </span>}
                    <strong>{p.username}</strong>
                    {p.roomId && <span className="admin-room-tag"> [{p.roomId}]</span>}
                  </div>
                  <div className="admin-player-stats">
                    <span className="admin-stat-hp">❤ {p.hp}</span>
                    <span className="admin-stat-money">$ {p.money}</span>
                    <span className="admin-pos-tiny">({Math.round(p.position.x)},{Math.round(p.position.z)})</span>
                  </div>
                  <div className="admin-player-actions" onClick={e => e.stopPropagation()}>
                    <button className="admin-action-btn" title="Uçuş" onClick={() => { socket.emit("admin_fly",{targetId:p.socketId}); fb("Uçuş toggle"); }}>✈</button>
                    <button className="admin-action-btn" title="God" onClick={() => { socket.emit("admin_god",{targetId:p.socketId}); fb("God toggle"); }}>⚡</button>
                    <button className="admin-action-btn tp" title="TP" onClick={() => { socket.emit("admin_teleport",{targetId:p.socketId,x:0,y:1.65,z:0}); fb("TP!"); }}>TP</button>
                    <button className="admin-action-btn kick" title="Kick" onClick={() => { if(confirm(`${p.username} atılsın mı?`)) { socket.emit("admin_kick",{targetId:p.socketId}); setPlayers(prev=>prev.filter(x=>x.socketId!==p.socketId)); }}}>Kick</button>
                  </div>
                </div>
              ))}
            </div>

            {selected && (
              <div className="admin-control-panel">
                <div className="admin-section-title">HIZLI KONTROL: <span style={{color:"#ffcc44"}}>{selected.username}</span></div>
                <div className="admin-quick-btns">
                  <button className="admin-qbtn" onClick={() => { socket.emit("admin_set_hp",{targetId:selected.socketId,hp:100}); fb("HP dolduruldu"); }}>❤ Dolu HP</button>
                  <button className="admin-qbtn" onClick={() => { socket.emit("admin_set_hp",{targetId:selected.socketId,hp:200}); fb("HP 200"); }}>❤❤ HP 200</button>
                  <button className="admin-qbtn" onClick={() => { socket.emit("admin_set_money",{targetId:selected.socketId,money:9999}); fb("$9999 verildi"); }}>💰 $9999</button>
                  <button className="admin-qbtn" onClick={() => { socket.emit("admin_fly",{targetId:selected.socketId}); fb("Uçuş toggle"); }}>✈ Uçuş</button>
                  <button className="admin-qbtn" onClick={() => { socket.emit("admin_god",{targetId:selected.socketId}); fb("God toggle"); }}>⚡ God</button>
                  <button className="admin-qbtn" onClick={() => { socket.emit("admin_teleport",{targetId:selected.socketId,x:0,y:1.65,z:0}); fb("TP!"); }}>📍 TP</button>
                  <button className="admin-qbtn danger" onClick={() => { if(confirm(`${selected.username} banlanıp atılsın mı?`)) socket.emit("admin_ban",{username:selected.username,reason:"Admin kararı"}); }}>🔨 Ban</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── COMMANDS TAB ─────────────────────────────────────────────── */}
        {tab === "commands" && (
          <div className="admin-cmd-panel">
            <div className="admin-cmd-history">
              {cmdHistory.length === 0 && <div className="admin-cmd-hint">Komut gir → Enter ile çalıştır</div>}
              {cmdHistory.map((h, i) => (
                <div key={i} className={`admin-cmd-line${h.ok?" ok":" err"}`}>
                  <span className="admin-cmd-prompt-txt">&gt; {h.cmd}</span>
                  <span className="admin-cmd-result">{h.result}</span>
                </div>
              ))}
              <div ref={cmdHistoryEndRef} />
            </div>
            <div className="admin-cmd-help-list">
              {CMD_HELP.map(h => (
                <div key={h.cmd} className="admin-cmd-help-row">
                  <code className="admin-cmd-code" onClick={() => setCmdInput(h.cmd.split(" ")[0])}>{h.cmd}</code>
                  <span className="admin-cmd-desc">{h.desc}</span>
                </div>
              ))}
            </div>
            <div className="admin-cmd-input-row">
              <span className="admin-cmd-prompt-prefix">&gt;</span>
              <input
                className="admin-cmd-input-field"
                value={cmdInput}
                onChange={e => setCmdInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") exec(cmdInput); }}
                placeholder="/komut argümanlar..."
                spellCheck={false} autoComplete="off"
              />
              <button className="admin-cmd-send" onClick={() => exec(cmdInput)}>↵</button>
            </div>
          </div>
        )}

        {/* ── SERVER TAB ────────────────────────────────────────────────── */}
        {tab === "server" && (
          <div className="admin-server-panel">
            <div className="admin-server-stats">
              {[
                { num: players.length,                        lbl: "Toplam Oyuncu" },
                { num: players.filter(p=>p.roomId).length,   lbl: "Odada" },
                { num: players.filter(p=>!p.roomId).length,  lbl: "Lobide" },
                { num: players.filter(p=>p.isFounder).length,lbl: "Kurucu" },
              ].map(s => (
                <div key={s.lbl} className="admin-stat-card">
                  <div className="admin-stat-num">{s.num}</div>
                  <div className="admin-stat-lbl">{s.lbl}</div>
                </div>
              ))}
            </div>

            <div className="admin-section-title">📢 SUNUCU DUYURUSU</div>
            <div className="admin-broadcast-row">
              <input
                className="admin-ctrl-input"
                value={broadcastMsg}
                onChange={e => setBroadcastMsg(e.target.value)}
                placeholder="Tüm oyunculara mesaj..."
                onKeyDown={e => { if (e.key === "Enter" && broadcastMsg.trim()) { socket.emit("admin_broadcast",{message:broadcastMsg.trim()}); fb("Duyuru gönderildi!"); setBroadcastMsg(""); }}}
                style={{ flex:1 }}
              />
              <button className="admin-ctrl-btn" onClick={() => {
                if (!broadcastMsg.trim()) return;
                socket.emit("admin_broadcast", { message: broadcastMsg.trim() });
                fb("Duyuru yayınlandı!"); setBroadcastMsg("");
              }}>📢 Yayınla</button>
            </div>

            <div className="admin-section-title" style={{marginTop:"12px"}}>⚡ HIZLI ETKİNLİKLER</div>
            <div className="admin-events-grid">
              {QUICK_EVENTS.map(ev => (
                <button key={ev.label} className="admin-event-btn" onClick={() => {
                  socket.emit("admin_event", { message: ev.msg });
                  if (ev.money > 0) socket.emit("admin_giveall", { money: ev.money });
                  fb(`${ev.label} başlatıldı!`);
                }}>{ev.label}</button>
              ))}
            </div>

            <div className="admin-section-title" style={{marginTop:"12px"}}>🗺️ ZORLA HARİTA DEĞİŞTİR</div>
            <div className="admin-map-btns">
              {["astral","canyon","frost","ruins","mars","volcano","space","egypt","cyberpunk","underwater"].map(m => (
                <button key={m} className="admin-map-btn" onClick={() => {
                  socket.emit("admin_force_map", { map: m });
                  fb(`Harita → ${m}`);
                }}>{m.toUpperCase()}</button>
              ))}
            </div>
          </div>
        )}

        {tab === "moderation" && (
          <div className="admin-cmd-panel">
            <div className="admin-section-title">KÜFÜR / BAN SEVİYESİ</div>
            <div className="admin-cmd-help-row">
              <span className="admin-cmd-desc">Chat ihlali</span>
              <button className={`admin-qbtn${banDuration==="chat"?" active":""}`} onClick={() => setBanDuration("chat")}>Chat Banı</button>
            </div>
            <div className="admin-cmd-help-row">
              <span className="admin-cmd-desc">Daha ileri giderse</span>
              <button className={`admin-qbtn${banDuration==="game-hour"?" active":""}`} onClick={() => setBanDuration("game-hour")}>Oyun Banı (Saatlik)</button>
            </div>
            <div className="admin-cmd-help-row">
              <span className="admin-cmd-desc">Tekrarında</span>
              <button className={`admin-qbtn${banDuration==="day"?" active":""}`} onClick={() => setBanDuration("day")}>Günlük Ban</button>
            </div>
            <div className="admin-cmd-help-row">
              <span className="admin-cmd-desc">Son aşama</span>
              <button className={`admin-qbtn${banDuration==="year"?" active":""}`} onClick={() => setBanDuration("year")}>Yıllık Ban</button>
            </div>
            <input className="admin-cmd-input-field" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Ban sebebi" />
          </div>
        )}
      </div>
    </div>
  );
}
