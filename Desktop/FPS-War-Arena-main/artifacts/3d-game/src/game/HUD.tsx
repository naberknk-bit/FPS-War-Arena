import type { PlayerClass } from "./CharacterSelect";
import type { WeaponId } from "./BuyMenu";
import { SpikeHUD, SpikeState } from "./Spike";

const CLASS_META: Record<PlayerClass, { icon: string; ability: string; color: string }> = {
  assault: { icon: "⚡", ability: "DASH", color: "#ff4655" },
  scout:   { icon: "📡", ability: "SCAN", color: "#44aaff" },
  support: { icon: "💡", ability: "FLASH", color: "#ffcc44" },
};

const WEAPON_ICONS: Record<WeaponId, string> = {
  pistol: "🔫", phantom: "👻", vandal: "⚡", operator: "🎯",
};

interface RadioToast { id: number; message: string; color: string; }

interface HUDProps {
  hp: number; maxHp: number; ammo: number; maxAmmo: number; kills: number;
  showSmoke: boolean; username: string; isFounder: boolean; roomId: string | null;
  playerClass: PlayerClass | null;
  abilityCooldown: number; maxAbilityCooldown: number;
  level: number; xp: number;
  radioToasts: RadioToast[];
  isReloading: boolean; flashActive: boolean;
  hitmarkerActive: boolean; criticalHit: boolean;
  currentWeapon: WeaponId;
  money: number;
  hasSpike: boolean; spikeState: SpikeState;
  isPlanting: boolean; plantProgress: number;
  isDefusing: boolean; defuseProgress: number;
  spikeTimeLeft: number;
  redScore: number; blueScore: number; round: number;
  roundMsg: string | null;
  rr: number; rrChange: number | null;
  isFly: boolean; isGod: boolean;
}

export default function HUD({
  hp, maxHp, ammo, maxAmmo, kills, username, isFounder, roomId,
  playerClass, abilityCooldown, maxAbilityCooldown, level, xp,
  radioToasts, isReloading, flashActive,
  hitmarkerActive, criticalHit, currentWeapon, money,
  hasSpike, spikeState, isPlanting, plantProgress, isDefusing, defuseProgress, spikeTimeLeft,
  redScore, blueScore, round, roundMsg, rr, rrChange, isFly, isGod,
}: HUDProps) {
  const hpPercent = Math.max(0, (hp / maxHp) * 100);
  const hpColor = hpPercent > 50 ? "#ff4655" : hpPercent > 25 ? "#ff8c00" : "#ff2020";
  const classMeta = playerClass ? CLASS_META[playerClass] : null;
  const abilityCooldownPct = maxAbilityCooldown > 0 ? Math.max(0, abilityCooldown / maxAbilityCooldown) : 0;
  const xpForNext = level * 500;
  const xpPrev = (level - 1) * 500;
  const xpProgress = Math.min((xp - xpPrev) / (xpForNext - xpPrev), 1);

  return (
    <div className="hud">
      {/* Flash */}
      {flashActive && <div className="flash-overlay" />}

      {/* Hitmarker */}
      {hitmarkerActive && (
        <div className={`hitmarker${criticalHit ? " hitmarker-crit" : ""}`}>
          <div className="hm-line hm-top" />
          <div className="hm-line hm-bottom" />
          <div className="hm-line hm-left" />
          <div className="hm-line hm-right" />
        </div>
      )}
      {criticalHit && hitmarkerActive && <div className="crit-text">KRİTİK VURUŞ!</div>}

      {/* Crosshair */}
      <div className="crosshair">
        <div className="crosshair-dot" />
      </div>

      {/* Round counter — always visible, max 13 */}
      <div className="round-score-bar">
        <span className="rs-red">{redScore}</span>
        <div className="rs-round-pips">
          {Array.from({ length: 13 }).map((_, i) => {
            const done = i < round - 1;
            const current = i === round - 1;
            return (
              <span
                key={i}
                className={`rs-pip${done ? " rs-pip-done" : ""}${current ? " rs-pip-current" : ""}`}
              />
            );
          })}
        </div>
        <span className="rs-blue">{blueScore}</span>
        <span className="rs-round-label">TUR {round}/13</span>
      </div>

      {/* Round message */}
      {roundMsg && <div className="round-msg-banner">{roundMsg}</div>}

      {/* Player name + level */}
      <div className="hud-name-bar">
        {isFounder && <span className="hud-founder-shield">🛡️</span>}
        <span className={isFounder ? "hud-name founder-hud-name" : "hud-name"}>{username}</span>
        <span className="hud-level-badge">LVL {level}</span>
        {roomId && <span className="hud-room-tag">· {roomId}</span>}
        {isFly && <span className="hud-mode-badge fly">✈ FLY</span>}
        {isGod && <span className="hud-mode-badge god">⚡ GOD</span>}
      </div>

      {/* XP bar */}
      <div className="hud-xp-bar-wrap">
        <div className="hud-xp-bar-track">
          <div className="hud-xp-bar-fill" style={{ width: `${xpProgress * 100}%` }} />
        </div>
        <span className="hud-xp-text">{xp} / {xpForNext} XP</span>
      </div>

      {/* RR change */}
      {rrChange !== null && (
        <div className={`rr-change-badge${rrChange > 0 ? " rr-up" : " rr-down"}`}>
          {rrChange > 0 ? `+${rrChange}` : rrChange} RR
        </div>
      )}

      {/* HP bar */}
      <div className="hp-bar-container">
        <div className="hp-label">❤ Sağlık</div>
        <div className="hp-bar-track">
          <div className="hp-bar-fill" style={{ width: `${hpPercent}%`, background: hpColor }} />
        </div>
        <div className="hp-value">{hp} / {maxHp}</div>
      </div>

      {/* Money */}
      <div className="money-display">💰 ${money}</div>

      {/* Weapon + Ammo */}
      <div className="ammo-container">
        <div className="weapon-icon-hud">{WEAPON_ICONS[currentWeapon]}</div>
        <div className="ammo-label">Mermi</div>
        <div className="ammo-count">{ammo} <span className="ammo-max">/ {maxAmmo}</span></div>
        {ammo === 0 && !isReloading && <div className="ammo-empty">BOŞALDI!</div>}
        {isReloading && <div className="ammo-reloading">◌ Şarjör...</div>}
      </div>

      {/* Ability indicator */}
      <div className="ability-indicator">
        <div className="ability-key">{classMeta ? `[E] ${classMeta.ability}` : "[E] Duman"}</div>
        <div className="ability-icon" style={classMeta ? { borderColor: classMeta.color + "88", background: `${classMeta.color}22` } : {}}>
          {classMeta ? classMeta.icon : "💨"}
        </div>
        {abilityCooldown > 0 && (<>
          <div className="ability-cooldown-bar">
            <div className="ability-cooldown-fill" style={{ width: `${(1 - abilityCooldownPct) * 100}%`, background: classMeta?.color ?? "#aaddff" }} />
          </div>
          <div className="ability-cooldown-text">{Math.ceil(abilityCooldown)}s</div>
        </>)}
      </div>

      {/* Class badge */}
      {classMeta && (
        <div className="class-badge-hud" style={{ color: classMeta.color, borderColor: classMeta.color + "55" }}>
          {classMeta.icon} {playerClass === "assault" ? "TAARRUZ" : playerClass === "scout" ? "KEŞİFÇİ" : "DESTEK"}
        </div>
      )}

      {/* Spike HUD */}
      <SpikeHUD
        hasSpike={hasSpike} spikeState={spikeState}
        isPlanting={isPlanting} plantProgress={plantProgress}
        isDefusing={isDefusing} defuseProgress={defuseProgress}
        timeLeft={spikeTimeLeft}
      />

      {/* Kill counter */}
      {kills > 0 && <div className="kill-feed-inline"><div className="kill-message" key={kills}>☠ {kills} yok etme</div></div>}

      {/* Radio toasts */}
      <div className="radio-toasts">
        {radioToasts.map((t) => (
          <div key={t.id} className="radio-toast" style={{ color: t.color, borderColor: t.color }}>📻 {t.message}</div>
        ))}
      </div>

      {/* Controls hint */}
      <div className="controls-hint">WASD · Boşluk: Zıpla · Sol Tık: Ateş · E: Yetenek · R: Şarjör · B: Al/Sat · TAB: Skor · F1-F4: Telsiz</div>
    </div>
  );
}
