import { useEffect } from "react";
import { playBuySound } from "./AudioEngine";

export type WeaponId = "pistol" | "phantom" | "vandal" | "operator";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  cost: number;
  ammo: number;
  fireRate: number;
  damage: number;
  icon: string;
  desc: string;
}

export const WEAPONS: WeaponDef[] = [
  { id: "pistol",  name: "Klasik",  cost: 0,    ammo: 15, fireRate: 6,  damage: 26,  icon: "🔫", desc: "Başlangıç silahı, ücretsiz." },
  { id: "phantom", name: "Phantom", cost: 2900, ammo: 30, fireRate: 11, damage: 39,  icon: "👻", desc: "Sessiz, hızlı, isabetli." },
  { id: "vandal",  name: "Vandal",  cost: 2900, ammo: 25, fireRate: 9,  damage: 49,  icon: "⚡", desc: "Yüksek hasar, tek kafa." },
  { id: "operator",name: "Operator",cost: 4700, ammo: 5,  fireRate: 1,  damage: 150, icon: "🎯", desc: "Bir mermi = bir ölüm." },
];

export const ARMOR_COST_LIGHT = 400;
export const ARMOR_COST_FULL  = 1000;

interface BuyMenuProps {
  money: number;
  currentWeapon: WeaponId;
  hasArmor: boolean;
  isOpen: boolean;
  onBuyWeapon: (w: WeaponDef) => void;
  onBuyArmor: (full: boolean) => void;
  onClose: () => void;
}

export default function BuyMenu({ money, currentWeapon, hasArmor, isOpen, onBuyWeapon, onBuyArmor, onClose }: BuyMenuProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "KeyB") { e.preventDefault(); onClose(); }
      if (e.code === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!isOpen) return null;

  const buy = (w: WeaponDef) => {
    if (money < w.cost) return;
    playBuySound();
    onBuyWeapon(w);
    onClose();
    // Pointer lock is released by the button click — the "click to play"
    // overlay will reappear automatically and let the user re-acquire it.
  };

  const buyArmor = (full: boolean) => {
    const cost = full ? ARMOR_COST_FULL : ARMOR_COST_LIGHT;
    if (money < cost) return;
    playBuySound();
    onBuyArmor(full);
    onClose();
  };

  return (
    <div className="buy-menu-overlay">
      <div className="buy-menu">
        <div className="buy-menu-header">
          <span className="buy-menu-title">🛒 SATIN ALMA [B]</span>
          <span className="buy-money">💰 ${money}</span>
          <button className="buy-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="buy-menu-body">
          <div className="buy-section">
            <div className="buy-section-title">SİLAHLAR</div>
            <div className="buy-weapon-grid">
              {WEAPONS.map((w) => {
                const canAfford = money >= w.cost;
                const owned = currentWeapon === w.id;
                return (
                  <div
                    key={w.id}
                    className={`buy-weapon-card${owned ? " owned" : ""}${!canAfford && !owned ? " cant-afford" : ""}`}
                    onClick={() => !owned && buy(w)}
                  >
                    <div className="buy-weapon-icon">{w.icon}</div>
                    <div className="buy-weapon-name">{w.name}</div>
                    <div className="buy-weapon-desc">{w.desc}</div>
                    <div className="buy-weapon-stats">
                      <span>💥 {w.damage}</span>
                      <span>🔄 {w.fireRate}/s</span>
                      <span>📦 {w.ammo}</span>
                    </div>
                    <div className={`buy-weapon-cost${!canAfford && !owned ? " cant-afford-text" : ""}`}>
                      {owned ? "✓ ELİMDE" : w.cost === 0 ? "ÜCRETSİZ" : `$${w.cost}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="buy-section">
            <div className="buy-section-title">KORUMA</div>
            <div className="buy-armor-row">
              <div
                className={`buy-armor-card${!hasArmor && money >= ARMOR_COST_LIGHT ? " buyable" : ""}${hasArmor ? " owned" : ""}`}
                onClick={() => !hasArmor && buyArmor(false)}
              >
                <span className="buy-armor-icon">🛡️</span>
                <span className="buy-armor-name">Hafif Zırh</span>
                <span className="buy-armor-sub">+50 HP</span>
                <span className="buy-armor-price">{hasArmor ? "✓" : `$${ARMOR_COST_LIGHT}`}</span>
              </div>
              <div
                className={`buy-armor-card${!hasArmor && money >= ARMOR_COST_FULL ? " buyable" : ""}${hasArmor ? " owned" : ""}`}
                onClick={() => !hasArmor && buyArmor(true)}
              >
                <span className="buy-armor-icon">🦺</span>
                <span className="buy-armor-name">Tam Zırh</span>
                <span className="buy-armor-sub">+100 HP</span>
                <span className="buy-armor-price">{hasArmor ? "✓" : `$${ARMOR_COST_FULL}`}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="buy-menu-hint">B / ESC — Kapat</div>
      </div>
    </div>
  );
}
