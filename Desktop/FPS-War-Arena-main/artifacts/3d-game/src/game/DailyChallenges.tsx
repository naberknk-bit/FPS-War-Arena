import { useState, useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";

interface Challenge {
  id: number;
  icon: string;
  title: string;
  desc: string;
  goal: number;
  reward: number;     // Bosna Coin ödülü
  type: ChallengeType;
}

type ChallengeType = "headshots" | "kills" | "spike_defuse" | "spike_plant" | "games" | "assists";

interface ChallengeProgress {
  progress: number;
  done: boolean;
  claimedAt?: string;
}

type ProgressMap = Record<number, ChallengeProgress>;

// Challenge havuzu — günlük seed ile 3 tanesi seçilir
const CHALLENGE_POOL: Challenge[] = [
  { id: 1, icon: "🎯", title: "Keskin Nişancı",    desc: "3 Kafa vuruşu yap",          goal: 3,  reward: 150, type: "headshots"    },
  { id: 2, icon: "💀", title: "Yıkım Makinesi",    desc: "10 rakip öldür",             goal: 10, reward: 120, type: "kills"        },
  { id: 3, icon: "💣", title: "İmha Uzmanı",        desc: "Spike'ı 1 kez imha et",     goal: 1,  reward: 200, type: "spike_defuse" },
  { id: 4, icon: "🔥", title: "Bomba Uzmanı",       desc: "Spike'ı 1 kez yer",        goal: 1,  reward: 180, type: "spike_plant"  },
  { id: 5, icon: "⚡", title: "Seri Katil",         desc: "5 öldürmede streak yap",    goal: 5,  reward: 250, type: "kills"        },
  { id: 6, icon: "🏆", title: "Maç Kazananı",       desc: "2 maç kazan",               goal: 2,  reward: 300, type: "games"        },
  { id: 7, icon: "🎪", title: "Kafa Avcısı",        desc: "5 kafa vuruşu yap",         goal: 5,  reward: 200, type: "headshots"    },
  { id: 8, icon: "👊", title: "Takım Oyuncusu",     desc: "20 öldürme katıl (assist)", goal: 20, reward: 150, type: "assists"      },
  { id: 9, icon: "🌪️", title: "Fırtına",            desc: "15 rakip öldür",            goal: 15, reward: 175, type: "kills"        },
];

function getTodayChallenges(): Challenge[] {
  const today = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const c of today) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  const indices: number[] = [];
  let seed = hash;
  while (indices.length < 3) {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    const i = seed % CHALLENGE_POOL.length;
    if (!indices.includes(i)) indices.push(i);
  }
  return indices.map(i => CHALLENGE_POOL[i]);
}

function getStorageKey() { return `daily_challenges_${new Date().toISOString().slice(0, 10)}`; }
function loadProgress(): ProgressMap {
  try { return JSON.parse(localStorage.getItem(getStorageKey()) ?? "{}"); } catch { return {}; }
}
function saveProgress(p: ProgressMap) { localStorage.setItem(getStorageKey(), JSON.stringify(p)); }

interface DailyChallengesProps {
  socket: Socket | null;
  isOpen: boolean;
  onClose: () => void;
  onCoinsEarned?: (amount: number) => void;
}

export default function DailyChallenges({ socket, isOpen, onClose, onCoinsEarned }: DailyChallengesProps) {
  const challenges = getTodayChallenges();
  const [progress, setProgress] = useState<ProgressMap>(() => loadProgress());
  const [claiming, setClaiming] = useState<number | null>(null);

  // Listen to socket events for progress tracking
  useEffect(() => {
    if (!socket) return;
    const handlers: Array<[string, (...args: unknown[]) => void]> = [
      ["kill_confirmed", (data: { isHeadshot?: boolean }) => {
        setProgress(prev => {
          const next = { ...prev };
          challenges.forEach(ch => {
            if (ch.type === "kills" || (ch.type === "headshots" && data.isHeadshot)) {
              const old = next[ch.id] ?? { progress: 0, done: false };
              if (!old.done) {
                const newProg = Math.min(old.progress + 1, ch.goal);
                next[ch.id] = { progress: newProg, done: newProg >= ch.goal };
              }
            }
          });
          saveProgress(next);
          return next;
        });
      }],
      ["spike_defused", () => {
        setProgress(prev => {
          const next = { ...prev };
          challenges.filter(ch => ch.type === "spike_defuse").forEach(ch => {
            const old = next[ch.id] ?? { progress: 0, done: false };
            if (!old.done) next[ch.id] = { progress: ch.goal, done: true };
          });
          saveProgress(next);
          return next;
        });
      }],
      ["spike_planted", () => {
        setProgress(prev => {
          const next = { ...prev };
          challenges.filter(ch => ch.type === "spike_plant").forEach(ch => {
            const old = next[ch.id] ?? { progress: 0, done: false };
            if (!old.done) next[ch.id] = { progress: ch.goal, done: true };
          });
          saveProgress(next);
          return next;
        });
      }],
    ];
    handlers.forEach(([ev, fn]) => socket.on(ev, fn as Parameters<typeof socket.on>[1]));
    return () => handlers.forEach(([ev, fn]) => socket.off(ev, fn as Parameters<typeof socket.off>[1]));
  }, [socket, challenges]);

  const claim = useCallback((ch: Challenge) => {
    const p = progress[ch.id];
    if (!p?.done || claiming !== null) return;
    setClaiming(ch.id);
    socket?.emit("claim_challenge_reward", { challengeId: ch.id, reward: ch.reward });
    setProgress(prev => { const next = { ...prev, [ch.id]: { ...prev[ch.id], claimedAt: new Date().toISOString() } }; saveProgress(next); return next; });
    onCoinsEarned?.(ch.reward);
    setTimeout(() => setClaiming(null), 1200);
  }, [progress, claiming, socket, onCoinsEarned]);

  if (!isOpen) return null;

  const totalEarnable = challenges.reduce((s, ch) => {
    const p = progress[ch.id];
    return s + (p?.claimedAt ? 0 : ch.reward);
  }, 0);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="daily-challenges-panel">
        <div className="daily-header">
          <div>
            <div className="daily-title">🗓 GÜNLÜK GÖREVLER</div>
            <div className="daily-subtitle">Bugün kazanılabilir: <span className="daily-coins-total">🪙 {totalEarnable}</span></div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="daily-challenges-list">
          {challenges.map(ch => {
            const p = progress[ch.id] ?? { progress: 0, done: false };
            const pct = Math.min((p.progress / ch.goal) * 100, 100);
            const claimed = !!p.claimedAt;
            return (
              <div key={ch.id} className={`daily-challenge-card${p.done ? " done" : ""}${claimed ? " claimed" : ""}`}>
                <div className="daily-ch-icon">{ch.icon}</div>
                <div className="daily-ch-info">
                  <div className="daily-ch-title">{ch.title}</div>
                  <div className="daily-ch-desc">{ch.desc}</div>
                  <div className="daily-progress-row">
                    <div className="daily-progress-bar">
                      <div className="daily-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="daily-progress-txt">{p.progress}/{ch.goal}</span>
                  </div>
                </div>
                <div className="daily-ch-reward">
                  {claimed ? (
                    <span className="daily-claimed-badge">✓ Alındı</span>
                  ) : p.done ? (
                    <button className="daily-claim-btn" onClick={() => claim(ch)} disabled={claiming === ch.id}>
                      {claiming === ch.id ? "..." : `+🪙 ${ch.reward}`}
                    </button>
                  ) : (
                    <span className="daily-reward-preview">🪙 {ch.reward}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="daily-footer">
          <span className="daily-reset-info">⏰ Görevler gece yarısı sıfırlanır</span>
        </div>
      </div>
    </div>
  );
}
