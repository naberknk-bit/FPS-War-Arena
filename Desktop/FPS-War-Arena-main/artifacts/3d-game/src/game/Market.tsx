import { useState, useRef, useEffect } from "react";

export interface InventoryItem {
  id: string;
  name: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  emoji: string;
}

const CRATE_ITEMS: InventoryItem[] = [
  { id: "skin_phantom_cyber", name: "Cyber Phantom", rarity: "epic", emoji: "🔵" },
  { id: "skin_vandal_fire", name: "Ateş Vandal", rarity: "legendary", emoji: "🔴" },
  { id: "skin_op_dragon", name: "Ejderha Operator", rarity: "legendary", emoji: "🟡" },
  { id: "skin_pistol_ghost", name: "Hayalet Tabanca", rarity: "rare", emoji: "⚪" },
  { id: "charm_skull", name: "Kafatası Charm", rarity: "rare", emoji: "💀" },
  { id: "spray_fire", name: "Ateş Spreyı", rarity: "common", emoji: "🔥" },
  { id: "spray_star", name: "Yıldız Spreyı", rarity: "common", emoji: "⭐" },
  { id: "title_hunter", name: "Avcı Unvanı", rarity: "rare", emoji: "🏹" },
  { id: "skin_vandal_neon", name: "Neon Vandal", rarity: "epic", emoji: "🟢" },
  { id: "charm_bomb", name: "Bomba Charm", rarity: "common", emoji: "💣" },
  { id: "skin_phantom_prime", name: "Prime Phantom", rarity: "legendary", emoji: "👑" },
  { id: "spray_rr", name: "Radyant Spreyı", rarity: "epic", emoji: "✨" },
];

const RARITY_COLOR: Record<string, string> = {
  common: "#888888",
  rare: "#4488ff",
  epic: "#aa44ff",
  legendary: "#ffcc44",
};

const CRATE_COST = 500;

function genReel(): InventoryItem[] {
  const pool: InventoryItem[] = [];
  for (let i = 0; i < 40; i++) {
    const r = Math.random();
    let candidates: InventoryItem[];
    if (r < 0.05) candidates = CRATE_ITEMS.filter((c) => c.rarity === "legendary");
    else if (r < 0.20) candidates = CRATE_ITEMS.filter((c) => c.rarity === "epic");
    else if (r < 0.50) candidates = CRATE_ITEMS.filter((c) => c.rarity === "rare");
    else candidates = CRATE_ITEMS.filter((c) => c.rarity === "common");
    pool.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }
  return pool;
}

interface MarketProps {
  isOpen: boolean;
  money: number;
  onClose: () => void;
  onSpendMoney: (amount: number) => void;
  inventory: InventoryItem[];
  onAddItem: (item: InventoryItem) => void;
}

export default function Market({ isOpen, money, onClose, onSpendMoney, inventory, onAddItem }: MarketProps) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "result">("idle");
  const [reel, setReel] = useState<InventoryItem[]>([]);
  const [winItem, setWinItem] = useState<InventoryItem | null>(null);
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState<"crate" | "inventory">("crate");
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  const targetOffsetRef = useRef(0);
  const ITEM_W = 120;

  const openCrate = () => {
    if (money < CRATE_COST || phase !== "idle") return;
    const newReel = genReel();
    const winIdx = 30; // item at index 30 is the winner
    const winnerItem = newReel[winIdx];
    setReel(newReel);
    setWinItem(winnerItem);
    setPhase("spinning");
    // Center the winner item: target offset = winIdx * ITEM_W - (visible_width/2) + ITEM_W/2
    const target = winIdx * ITEM_W - 300 + ITEM_W / 2;
    startOffsetRef.current = 0;
    targetOffsetRef.current = target;
    startTimeRef.current = performance.now();
    setOffset(0);
    onSpendMoney(CRATE_COST);

    const DURATION = 3000;
    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const cur = startOffsetRef.current + eased * (targetOffsetRef.current - startOffsetRef.current);
      setOffset(cur);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setOffset(targetOffsetRef.current);
        setPhase("result");
        onAddItem(winnerItem);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="market-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="market-panel">
        <div className="market-header">
          <span className="market-title">🛒 MARKET</span>
          <span className="market-money">💰 ${money}</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="market-tabs">
          <button className={`market-tab${tab === "crate" ? " active" : ""}`} onClick={() => setTab("crate")}>Kasa</button>
          <button className={`market-tab${tab === "inventory" ? " active" : ""}`} onClick={() => setTab("inventory")}>Envanter ({inventory.length})</button>
        </div>

        {tab === "crate" && (
          <div className="market-crate">
            <div className="crate-reel-wrap">
              <div className="crate-reel-window">
                <div className="crate-reel-pointer" />
                <div className="crate-reel" style={{ transform: `translateX(-${offset}px)` }}>
                  {reel.map((item, i) => (
                    <div key={i} className="crate-item" style={{ borderColor: RARITY_COLOR[item.rarity] }}>
                      <span className="crate-item-emoji">{item.emoji}</span>
                      <span className="crate-item-name" style={{ color: RARITY_COLOR[item.rarity] }}>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {phase === "result" && winItem && (
              <div className="crate-result" style={{ borderColor: RARITY_COLOR[winItem.rarity] }}>
                <div className="crate-result-emoji">{winItem.emoji}</div>
                <div className="crate-result-name" style={{ color: RARITY_COLOR[winItem.rarity] }}>{winItem.name}</div>
                <div className="crate-result-rarity" style={{ color: RARITY_COLOR[winItem.rarity] }}>{winItem.rarity.toUpperCase()}</div>
              </div>
            )}

            <div className="crate-info">
              <div className="crate-probabilities">
                <span style={{ color: "#888888" }}>Common 50%</span>
                <span style={{ color: "#4488ff" }}>Rare 30%</span>
                <span style={{ color: "#aa44ff" }}>Epic 15%</span>
                <span style={{ color: "#ffcc44" }}>Legendary 5%</span>
              </div>
              <button
                className="crate-open-btn"
                onClick={() => { if (phase !== "idle") setPhase("idle"); else openCrate(); }}
                disabled={money < CRATE_COST && phase === "idle"}
              >
                {phase === "spinning" ? "Döndürülüyor..." : phase === "result" ? "Tekrar Aç ($500)" : `Kasa Aç ($${CRATE_COST})`}
              </button>
            </div>
          </div>
        )}

        {tab === "inventory" && (
          <div className="market-inventory">
            {inventory.length === 0 ? (
              <div className="lb-empty">Envanteriniz boş.</div>
            ) : (
              inventory.map((item) => (
                <div key={item.id + Math.random()} className="inv-item" style={{ borderColor: RARITY_COLOR[item.rarity] }}>
                  <span className="inv-emoji">{item.emoji}</span>
                  <div>
                    <div className="inv-name">{item.name}</div>
                    <div className="inv-rarity" style={{ color: RARITY_COLOR[item.rarity] }}>{item.rarity.toUpperCase()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
