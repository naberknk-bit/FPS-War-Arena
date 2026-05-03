import { useState, useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";

interface SkinItem {
  id: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  emoji: string;
  serialNumber: string;
}

const RARITY_COLORS = {
  common:    "#888888",
  rare:      "#4488ff",
  epic:      "#aa44ff",
  legendary: "#ff8800",
};

const RARITY_LABELS = {
  common:    "Yaygın",
  rare:      "Nadir",
  epic:      "Epik",
  legendary: "Efsanevi",
};

const MY_SKINS: SkinItem[] = [
  { id: "classic",  name: "Klasik",          rarity: "common",    emoji: "🔫", serialNumber: `#${Math.floor(Math.random()*90000+10000)}` },
  { id: "ghost",    name: "Hayalet",          rarity: "rare",      emoji: "👻", serialNumber: `#${Math.floor(Math.random()*90000+10000)}` },
  { id: "dragon",   name: "Ejder",            rarity: "legendary", emoji: "🐉", serialNumber: `#${Math.floor(Math.random()*90000+10000)}` },
  { id: "crystal",  name: "Kristal",          rarity: "epic",      emoji: "💎", serialNumber: `#${Math.floor(Math.random()*90000+10000)}` },
  { id: "neon",     name: "Neon",             rarity: "rare",      emoji: "⚡", serialNumber: `#${Math.floor(Math.random()*90000+10000)}` },
];

interface TradeRequest {
  fromSocketId: string;
  fromUsername: string;
  offeredSkin: SkinItem;
  wantedSkin: SkinItem;
}

interface TradeWindowProps {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
  localUsername: string;
}

export default function TradeWindow({ isOpen, onClose, socket, localUsername }: TradeWindowProps) {
  const [mySelectedSkin, setMySelectedSkin] = useState<SkinItem | null>(null);
  const [targetUsername, setTargetUsername] = useState("");
  const [wantedSkinName, setWantedSkinName] = useState("");
  const [incomingTrade, setIncomingTrade] = useState<TradeRequest | null>(null);
  const [sentRequest, setSentRequest] = useState(false);
  const [feedback, setFeedback] = useState("");

  const fb = useCallback((msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(""), 3000); }, []);

  useEffect(() => {
    if (!socket) return;
    const onTradeRequest = (req: TradeRequest) => setIncomingTrade(req);
    const onTradeAccepted = ({ fromUsername: fu }: { fromUsername: string }) => {
      fb(`✅ ${fu} takası kabul etti!`);
      setSentRequest(false);
    };
    const onTradeDeclined = ({ fromUsername: fu }: { fromUsername: string }) => {
      fb(`❌ ${fu} takası reddetti.`);
      setSentRequest(false);
    };
    const onTradeCancelled = () => { setIncomingTrade(null); fb("Takas iptal edildi."); };

    socket.on("trade_request", onTradeRequest);
    socket.on("trade_accepted", onTradeAccepted);
    socket.on("trade_declined", onTradeDeclined);
    socket.on("trade_cancelled", onTradeCancelled);
    return () => {
      socket.off("trade_request", onTradeRequest);
      socket.off("trade_accepted", onTradeAccepted);
      socket.off("trade_declined", onTradeDeclined);
      socket.off("trade_cancelled", onTradeCancelled);
    };
  }, [socket, fb]);

  const sendTradeRequest = useCallback(() => {
    if (!socket || !mySelectedSkin || !targetUsername.trim()) return;
    socket.emit("trade_request", {
      toUsername: targetUsername.trim(),
      offeredSkin: mySelectedSkin,
      wantedSkinName: wantedSkinName.trim() || "Herhangi bir skin",
    });
    setSentRequest(true);
    fb(`📨 Takas isteği ${targetUsername}'e gönderildi`);
  }, [socket, mySelectedSkin, targetUsername, wantedSkinName, fb]);

  const acceptTrade = useCallback(() => {
    if (!socket || !incomingTrade) return;
    socket.emit("trade_accept", { fromSocketId: incomingTrade.fromSocketId });
    setIncomingTrade(null);
    fb("✅ Takas kabul edildi!");
  }, [socket, incomingTrade, fb]);

  const declineTrade = useCallback(() => {
    if (!socket || !incomingTrade) return;
    socket.emit("trade_decline", { fromSocketId: incomingTrade.fromSocketId });
    setIncomingTrade(null);
    fb("Takas reddedildi.");
  }, [socket, incomingTrade, fb]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="trade-window">
        <div className="trade-header">
          <span className="trade-icon">🔄</span>
          <h2 className="trade-title">SKIN TAKASİ</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Incoming trade request */}
        {incomingTrade && (
          <div className="trade-incoming">
            <div className="trade-incoming-title">📨 Takas İsteği Geldi!</div>
            <div className="trade-incoming-from">
              <strong>{incomingTrade.fromUsername}</strong> sana şunu teklif ediyor:
            </div>
            <div className="trade-incoming-skin" style={{ borderColor: RARITY_COLORS[incomingTrade.offeredSkin.rarity] }}>
              <span className="trade-skin-emoji">{incomingTrade.offeredSkin.emoji}</span>
              <div>
                <div className="trade-skin-name">{incomingTrade.offeredSkin.name}</div>
                <div className="trade-skin-rarity" style={{ color: RARITY_COLORS[incomingTrade.offeredSkin.rarity] }}>
                  {RARITY_LABELS[incomingTrade.offeredSkin.rarity]}
                </div>
                <div className="trade-skin-serial">{incomingTrade.offeredSkin.serialNumber}</div>
              </div>
            </div>
            <div className="trade-incoming-want">Karşılığında: <em>{incomingTrade.wantedSkin?.name ?? "Herhangi bir skin"}</em></div>
            <div className="trade-incoming-btns">
              <button className="trade-accept-btn" onClick={acceptTrade}>✅ Kabul Et</button>
              <button className="trade-decline-btn" onClick={declineTrade}>❌ Reddet</button>
            </div>
          </div>
        )}

        <div className="trade-body">
          {/* My skins */}
          <div className="trade-my-skins">
            <h3 className="trade-section-title">📦 Skinlerim</h3>
            <div className="trade-skin-grid">
              {MY_SKINS.map(skin => (
                <button
                  key={skin.id}
                  className={`trade-skin-card${mySelectedSkin?.id === skin.id ? " selected" : ""}`}
                  style={{ "--rarity-color": RARITY_COLORS[skin.rarity] } as React.CSSProperties}
                  onClick={() => setMySelectedSkin(mySelectedSkin?.id === skin.id ? null : skin)}
                >
                  <span className="trade-skin-emoji">{skin.emoji}</span>
                  <div className="trade-skin-info">
                    <div className="trade-skin-name">{skin.name}</div>
                    <div className="trade-skin-rarity" style={{ color: RARITY_COLORS[skin.rarity] }}>
                      {RARITY_LABELS[skin.rarity]}
                    </div>
                    <div className="trade-skin-serial">{skin.serialNumber}</div>
                  </div>
                  {mySelectedSkin?.id === skin.id && <div className="trade-selected-badge">TEKLİF</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Trade form */}
          <div className="trade-form">
            <h3 className="trade-section-title">📤 Takas Gönder</h3>
            <div className="trade-form-body">
              <label className="trade-label">Hedef Oyuncu</label>
              <input
                className="trade-input"
                value={targetUsername}
                onChange={e => setTargetUsername(e.target.value)}
                placeholder="Kullanıcı adı..."
                maxLength={30}
              />
              <label className="trade-label">İstediğin Skin</label>
              <input
                className="trade-input"
                value={wantedSkinName}
                onChange={e => setWantedSkinName(e.target.value)}
                placeholder="Örn: Ejder, Kristal..."
                maxLength={30}
              />
              {mySelectedSkin ? (
                <div className="trade-selected-preview" style={{ borderColor: RARITY_COLORS[mySelectedSkin.rarity] }}>
                  <span>{mySelectedSkin.emoji}</span>
                  <span>{mySelectedSkin.name} teklif edilecek</span>
                  <span className="trade-skin-serial">{mySelectedSkin.serialNumber}</span>
                </div>
              ) : (
                <div className="trade-no-skin">← Teklif edecek skini seç</div>
              )}
              <button
                className="trade-send-btn"
                onClick={sendTradeRequest}
                disabled={!mySelectedSkin || !targetUsername.trim() || sentRequest}
              >
                {sentRequest ? "⏳ Bekleniyor..." : "📨 Takas İste"}
              </button>
            </div>
          </div>
        </div>

        {feedback && <div className="trade-feedback">{feedback}</div>}
      </div>
    </div>
  );
}
