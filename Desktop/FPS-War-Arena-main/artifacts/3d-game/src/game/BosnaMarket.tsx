import { useState, useEffect, useCallback } from "react";

interface MarketListing {
  id: number;
  sellerName: string;
  skinId: string;
  skinName: string;
  price: number;
  listedAt: string;
}

interface OwnedSkin { skinId: string; skinName: string; rarity: "rare" | "dragon" | "legendary" }
type PlayerSkin = "default" | "dragon" | "legendary" | "rare_red" | "rare_blue" | "rare_gold";

const SKIN_CATALOG: OwnedSkin[] = [
  { skinId: "dragon",    skinName: "Dragon Deri",    rarity: "dragon"    },
  { skinId: "legendary", skinName: "Efsane Zırh",    rarity: "legendary" },
  { skinId: "rare_red",  skinName: "Kızıl Kasırga",  rarity: "rare"      },
  { skinId: "rare_blue", skinName: "Mavi Şimşek",    rarity: "rare"      },
  { skinId: "rare_gold", skinName: "Altın Savaşçı",  rarity: "rare"      },
];

const RARITY_COLORS: Record<OwnedSkin["rarity"], string> = {
  rare:      "#4488ff",
  dragon:    "#ff6600",
  legendary: "#cc44ff",
};

const BASE = `${import.meta.env.BASE_URL}api`;

async function fetchListings(): Promise<MarketListing[]> {
  const r = await fetch(`${BASE}/market`);
  if (!r.ok) return [];
  return (await r.json()).listings ?? [];
}

async function buyListing(id: number, token: string): Promise<{ ok: boolean; message?: string }> {
  const r = await fetch(`${BASE}/market/buy/${id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const d = await r.json();
  return { ok: r.ok, message: d.error ?? d.message };
}

async function createListing(skinId: string, skinName: string, price: number, token: string): Promise<{ ok: boolean; message?: string }> {
  const r = await fetch(`${BASE}/market/sell`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ skinId, skinName, price }),
  });
  const d = await r.json();
  return { ok: r.ok, message: d.error ?? d.message };
}

interface BosnaMarketProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  bosnaCoins: number;
  onCoinsChange?: (newAmount: number) => void;
  onSkinSelect?: (skinId: PlayerSkin) => void;
}

export default function BosnaMarket({ isOpen, onClose, token, bosnaCoins, onCoinsChange, onSkinSelect }: BosnaMarketProps) {
  const [tab, setTab]               = useState<"browse" | "sell">("browse");
  const [listings, setListings]     = useState<MarketListing[]>([]);
  const [loading, setLoading]       = useState(false);
  const [feedback, setFeedback]     = useState("");
  const [feedbackOk, setFeedbackOk] = useState(true);

  // Sell form
  const [sellSkin, setSellSkin]   = useState(SKIN_CATALOG[0].skinId);
  const [sellPrice, setSellPrice] = useState(500);

  const fb = (msg: string, ok = true) => { setFeedback(msg); setFeedbackOk(ok); setTimeout(() => setFeedback(""), 3000); };

  const reload = useCallback(async () => {
    setLoading(true);
    setListings(await fetchListings());
    setLoading(false);
  }, []);

  useEffect(() => { if (isOpen) reload(); }, [isOpen, reload]);

  const handleBuy = async (listing: MarketListing) => {
    if (bosnaCoins < listing.price) { fb(`Yetersiz Bosna Coin! ${listing.price - bosnaCoins} eksik.`, false); return; }
    const res = await buyListing(listing.id, token);
    if (res.ok) {
      fb(`✓ ${listing.skinName} satın alındı!`);
      onCoinsChange?.(bosnaCoins - listing.price);
      reload();
    } else {
      fb(res.message ?? "Satın alma başarısız", false);
    }
  };

  const handleSell = async () => {
    const skin = SKIN_CATALOG.find(s => s.skinId === sellSkin);
    if (!skin) return;
    if (sellPrice < 50) { fb("Minimum fiyat 50 Bosna Coin", false); return; }
    const res = await createListing(skin.skinId, skin.skinName, sellPrice, token);
    if (res.ok) { fb("✓ Skin pazara eklendi!"); reload(); setTab("browse"); }
    else        { fb(res.message ?? "İşlem başarısız", false); }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bosna-market-panel">
        <div className="market-header">
          <div>
            <div className="market-title">🪙 BOSNA PAZARYERİ</div>
            <div className="market-coins-display">Bakiye: <strong className="coins-highlight">🪙 {bosnaCoins.toLocaleString()}</strong></div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="market-tabs">
          <button className={`market-tab${tab==="browse"?" active":""}`} onClick={() => setTab("browse")}>🛒 Satın Al ({listings.length})</button>
          <button className={`market-tab${tab==="sell"?" active":""}`} onClick={() => setTab("sell")}>💰 Sat</button>
        </div>

        {feedback && <div className={`market-feedback${feedbackOk?" ok":" err"}`}>{feedback}</div>}

        {tab === "browse" && (
          <div className="market-listings">
            {loading && <div className="market-loading">Yükleniyor...</div>}
            {!loading && listings.length === 0 && (
              <div className="market-empty">
                <div style={{ fontSize:"2.5rem", marginBottom:"12px" }}>🛒</div>
                <div>Pazaryeri şu an boş.</div>
                <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.4)", marginTop:"6px" }}>İlk satıcı sen ol!</div>
              </div>
            )}
            {listings.map(l => {
              const skin = SKIN_CATALOG.find(s => s.skinId === l.skinId);
              const rarColor = RARITY_COLORS[skin?.rarity ?? "rare"];
              return (
                <div key={l.id} className="market-listing-row">
                  <div className="market-listing-skin-icon" style={{ color: rarColor }}>
                    {skin?.rarity === "dragon" ? "🐉" : skin?.rarity === "legendary" ? "⚡" : "🛡️"}
                  </div>
                  <div className="market-listing-info">
                    <div className="market-listing-name" style={{ color: rarColor }}>{l.skinName}</div>
                    <div className="market-listing-seller">Satıcı: {l.sellerName}</div>
                    <div className="market-listing-rarity" style={{ color: rarColor }}>
                      {skin?.rarity === "dragon" ? "DRAGON" : skin?.rarity === "legendary" ? "EFSANE" : "NADİR"}
                    </div>
                  </div>
                  <div className="market-listing-price-col">
                    <div className="market-listing-price">🪙 {l.price.toLocaleString()}</div>
                    <button
                      className={`market-buy-btn${bosnaCoins < l.price ? " disabled" : ""}`}
                      onClick={() => handleBuy(l)}
                      disabled={bosnaCoins < l.price}
                    >
                      {bosnaCoins < l.price ? "Yetersiz" : "Satın Al"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "sell" && (
          <div className="market-sell-form">
            <div className="sell-section-title">Hangi skini satmak istiyorsun?</div>
            <div className="sell-skin-grid">
              {SKIN_CATALOG.map(s => (
                <div key={s.skinId} className={`sell-skin-card${sellSkin===s.skinId?" selected":""}`}
                  onClick={() => setSellSkin(s.skinId)}
                  style={{ borderColor: sellSkin===s.skinId ? RARITY_COLORS[s.rarity] : undefined }}
                >
                  <div style={{ fontSize:"1.6rem" }}>{s.rarity === "dragon" ? "🐉" : s.rarity === "legendary" ? "⚡" : "🛡️"}</div>
                  <div style={{ fontSize:"0.7rem", color: RARITY_COLORS[s.rarity], marginTop:"4px" }}>{s.skinName}</div>
                </div>
              ))}
            </div>

            <div className="sell-price-row">
              <label className="sell-price-label">Fiyat (Bosna Coin):</label>
              <div className="sell-price-controls">
                <button className="sell-price-btn" onClick={() => setSellPrice(p => Math.max(50, p - 50))}>−</button>
                <input
                  className="sell-price-input"
                  type="number" min={50} max={99999}
                  value={sellPrice}
                  onChange={e => setSellPrice(Math.max(50, parseInt(e.target.value) || 50))}
                />
                <button className="sell-price-btn" onClick={() => setSellPrice(p => p + 50)}>+</button>
              </div>
            </div>

            <div className="sell-fee-note">Pazar yeri komisyonu: %10 ({Math.floor(sellPrice * 0.1)} coin)</div>
            <button className="sell-confirm-btn" onClick={handleSell}>
              🪙 Pazara Ekle — {sellPrice} Bosna Coin
            </button>
            <button className="sell-confirm-btn" onClick={() => onSkinSelect?.(sellSkin as PlayerSkin)} style={{ marginTop: "10px" }}>
              Bu skini giy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
