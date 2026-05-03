import { useState, useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";

interface AuctionListing {
  id: string;
  sellerUsername: string;
  skinName: string;
  skinEmoji: string;
  skinRarity: "common" | "rare" | "epic" | "legendary";
  startPrice: number;
  currentBid: number;
  currentBidder: string | null;
  endsAt: number;
}

interface AuctionHouseProps {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
  bosnaCoins: number;
  myUsername: string;
  onCoinsChange: (delta: number) => void;
}

const RARITY_COLOR: Record<string, string> = {
  common:    "#888",
  rare:      "#4488ff",
  epic:      "#aa44ff",
  legendary: "#ff8800",
};
const RARITY_LABEL: Record<string, string> = {
  common: "Yaygın", rare: "Nadir", epic: "Epik", legendary: "Efsanevi",
};

function timeLeft(endsAt: number) {
  const sec = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
  if (sec <= 0) return "Bitti";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}d ${s}s` : `${s}s`;
}

const DEMO_LISTINGS: AuctionListing[] = [
  { id: "l1", sellerUsername: "SnipeKing",  skinName: "Ejder Ateşi", skinEmoji: "🐉", skinRarity: "legendary", startPrice: 5000, currentBid: 7200, currentBidder: "BladeX",  endsAt: Date.now() + 8 * 60 * 1000 },
  { id: "l2", sellerUsername: "NightWolf",  skinName: "Hayalet",     skinEmoji: "👻", skinRarity: "epic",      startPrice: 1500, currentBid: 2300, currentBidder: "ShadowR", endsAt: Date.now() + 22 * 60 * 1000 },
  { id: "l3", sellerUsername: "Pixel",      skinName: "Kristal",     skinEmoji: "💎", skinRarity: "epic",      startPrice: 800,  currentBid: 900,  currentBidder: null,       endsAt: Date.now() + 55 * 60 * 1000 },
  { id: "l4", sellerUsername: "CyberX",     skinName: "Neon Gece",   skinEmoji: "⚡", skinRarity: "rare",      startPrice: 300,  currentBid: 420,  currentBidder: "CityGhost",endsAt: Date.now() + 2 * 60 * 60 * 1000 },
];

export default function AuctionHouse({ isOpen, onClose, socket, bosnaCoins, myUsername, onCoinsChange }: AuctionHouseProps) {
  const [listings, setListings] = useState<AuctionListing[]>(DEMO_LISTINGS);
  const [selected, setSelected]   = useState<AuctionListing | null>(null);
  const [bidAmount, setBidAmount]  = useState(0);
  const [feedback, setFeedback]    = useState("");
  const [tab, setTab]              = useState<"browse"|"my">("browse");
  const [tick, setTick]            = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("auction_listings", (data: AuctionListing[]) => setListings(data));
    socket.on("auction_bid_update", (data: { id: string; currentBid: number; currentBidder: string }) => {
      setListings(prev => prev.map(l => l.id === data.id ? { ...l, currentBid: data.currentBid, currentBidder: data.currentBidder } : l));
    });
    socket.on("auction_bid_won", ({ listing }: { listing: AuctionListing }) => {
      setFeedback(`🎉 "${listing.skinName}" skinini ${listing.currentBid} Bosna Coin'e kazandın!`);
      onCoinsChange(-listing.currentBid);
    });
    socket.emit("auction_get_listings");
    return () => {
      socket.off("auction_listings");
      socket.off("auction_bid_update");
      socket.off("auction_bid_won");
    };
  }, [socket, onCoinsChange]);

  const fb = useCallback((msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(""), 3500); }, []);

  const placeBid = useCallback(() => {
    if (!selected || !socket) return;
    if (bidAmount <= selected.currentBid) { fb("⚠ Teklifiniz mevcut tekliften yüksek olmalı!"); return; }
    if (bidAmount > bosnaCoins) { fb("⚠ Yeterli Bosna Coin yok!"); return; }
    socket.emit("auction_bid", { listingId: selected.id, amount: bidAmount });
    setListings(prev => prev.map(l => l.id === selected.id ? { ...l, currentBid: bidAmount, currentBidder: myUsername } : l));
    setSelected(prev => prev ? { ...prev, currentBid: bidAmount, currentBidder: myUsername } : prev);
    fb(`✓ ${bidAmount} Bosna Coin teklif verildi!`);
  }, [selected, socket, bidAmount, bosnaCoins, myUsername, fb]);

  if (!isOpen) return null;

  const myListings = listings.filter(l => l.sellerUsername === myUsername);
  const display    = tab === "browse" ? listings : myListings;

  return (
    <div className="auction-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="auction-panel">
        <div className="auction-header">
          <div className="auction-title">🏛️ AÇIK ARTIRMA</div>
          <div className="auction-coins">🪙 {bosnaCoins.toLocaleString()}</div>
          <button className="auction-close" onClick={onClose}>✕</button>
        </div>

        <div className="auction-tabs">
          <button className={`auction-tab${tab === "browse" ? " active" : ""}`} onClick={() => setTab("browse")}>TÜM İLANLAR</button>
          <button className={`auction-tab${tab === "my"     ? " active" : ""}`} onClick={() => setTab("my")}>İLANLARIM</button>
        </div>

        <div className="auction-body">
          <div className="auction-list">
            {display.length === 0 && <div className="auction-empty">Henüz ilan yok</div>}
            {display.map(l => (
              <div
                key={l.id}
                className={`auction-item${selected?.id === l.id ? " selected" : ""}`}
                onClick={() => { setSelected(l); setBidAmount(l.currentBid + 50); }}
              >
                <div className="auction-item-emoji">{l.skinEmoji}</div>
                <div className="auction-item-info">
                  <div className="auction-item-name" style={{ color: RARITY_COLOR[l.skinRarity] }}>{l.skinName}</div>
                  <div className="auction-item-rarity">{RARITY_LABEL[l.skinRarity]}</div>
                  <div className="auction-item-seller">Satıcı: {l.sellerUsername}</div>
                </div>
                <div className="auction-item-right">
                  <div className="auction-item-bid">🪙 {l.currentBid.toLocaleString()}</div>
                  {l.currentBidder && <div className="auction-item-bidder">{l.currentBidder}</div>}
                  <div className="auction-item-timer" style={{ color: timeLeft(l.endsAt) === "Bitti" ? "#ff4444" : "#aaa" }}>
                    ⏱ {timeLeft(l.endsAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selected && tab === "browse" && (
            <div className="auction-detail">
              <div className="auction-detail-title" style={{ color: RARITY_COLOR[selected.skinRarity] }}>
                {selected.skinEmoji} {selected.skinName}
              </div>
              <div className="auction-detail-row"><span>Mevcut Teklif</span><span>🪙 {selected.currentBid.toLocaleString()}</span></div>
              <div className="auction-detail-row"><span>Yüksek Teklif Veren</span><span>{selected.currentBidder ?? "—"}</span></div>
              <div className="auction-detail-row"><span>Bitiş</span><span style={{ color: "#ff8888" }}>{timeLeft(selected.endsAt)}</span></div>
              {selected.sellerUsername !== myUsername && (
                <>
                  <div className="auction-bid-row">
                    <button className="auction-bid-adj" onClick={() => setBidAmount(b => Math.max(selected.currentBid + 1, b - 50))}>−50</button>
                    <input
                      className="auction-bid-input"
                      type="number"
                      value={bidAmount}
                      onChange={e => setBidAmount(Number(e.target.value))}
                      min={selected.currentBid + 1}
                    />
                    <button className="auction-bid-adj" onClick={() => setBidAmount(b => b + 50)}>+50</button>
                  </div>
                  <button className="auction-place-bid" onClick={placeBid} disabled={bidAmount > bosnaCoins}>
                    {bidAmount > bosnaCoins ? "⚠ Yetersiz Coin" : `🪙 ${bidAmount.toLocaleString()} Teklif Ver`}
                  </button>
                </>
              )}
              {feedback && <div className="auction-feedback">{feedback}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
