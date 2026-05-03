import { useEffect, useState, useRef } from "react";

interface DeathScreenProps {
  isMultiplayer: boolean;
  onRespawn: () => void;
  killedBy?: string;
  killedByIsFounder?: boolean;
}

export default function DeathScreen({ isMultiplayer, onRespawn, killedBy, killedByIsFounder }: DeathScreenProps) {
  const [countdown, setCountdown] = useState(5);
  const onRespawnRef = useRef(onRespawn);
  onRespawnRef.current = onRespawn;

  useEffect(() => {
    if (isMultiplayer) return;

    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isMultiplayer]);

  // Call onRespawn outside of setState to avoid "setState during render" error
  useEffect(() => {
    if (!isMultiplayer && countdown === 0) {
      const t = setTimeout(() => onRespawnRef.current(), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [countdown, isMultiplayer]);

  return (
    <div className="death-overlay">
      <div className="death-vignette" />
      <div className="death-content">
        <div className="death-skull">💀</div>
        <div className="death-title">ÖLDÜNüZ</div>

        {killedBy && (
          <div className="death-killer">
            {killedByIsFounder && "🛡️ "}
            <span className="death-killer-name">{killedBy}</span>
            <span className="death-killer-by"> tarafından öldürüldünüz</span>
          </div>
        )}

        {isMultiplayer ? (
          <div className="death-wait">
            <div className="death-wait-pulse" />
            <div className="death-wait-text">TUR BİTİŞİNİ BEKLİYORSUNUZ</div>
            <div className="death-wait-sub">Tur bittiğinde yeniden doğacaksınız</div>
          </div>
        ) : (
          <div className="death-respawn">
            <div className="death-respawn-label">YENİDEN DOĞUYOR</div>
            <div className="death-respawn-countdown">{countdown}</div>
            <div className="death-respawn-bar">
              <div className="death-respawn-fill" style={{ width: `${((5 - countdown) / 5) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
