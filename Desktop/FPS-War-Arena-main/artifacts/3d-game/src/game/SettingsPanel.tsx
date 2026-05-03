interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  mobileMode: boolean;
  onMobileModeToggle: (v: boolean) => void;
  sensitivity: number;
  onSensitivity: (v: number) => void;
  isFounder: boolean;
  onOpenAdmin: () => void;
  perfMode: boolean;
  onPerfModeToggle: (v: boolean) => void;
}

export default function SettingsPanel({
  isOpen, onClose, mobileMode, onMobileModeToggle, sensitivity, onSensitivity, isFounder, onOpenAdmin,
  perfMode, onPerfModeToggle,
}: SettingsProps) {
  if (!isOpen) return null;
  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel">
        <div className="settings-header">
          <span className="settings-title">⚙ AYARLAR</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-body">

          {/* Performance Mode — always first, most prominent */}
          <div className={`settings-row perf-row${perfMode ? " perf-row--active" : ""}`}>
            <div className="perf-row-info">
              <span className="settings-label">⚡ PERFORMANS MODU</span>
              <span className="perf-row-sub">
                {perfMode ? "Ultra-Düşük Grafik — Aktif" : "Tüm efektler açık"}
              </span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={perfMode}
                onChange={(e) => {
                  onPerfModeToggle(e.target.checked);
                  localStorage.setItem("perf_mode", String(e.target.checked));
                }}
              />
              <span className="toggle-slider toggle-slider--perf" />
            </label>
          </div>

          {perfMode && (
            <div className="perf-checklist">
              <div className="perf-check">✓ Post-processing kapalı (Bloom/DOF/CA)</div>
              <div className="perf-check">✓ Gölgeler devre dışı</div>
              <div className="perf-check">✓ Karmaşık ışıklar kapalı</div>
              <div className="perf-check">✓ Parçacık sistemleri kapalı</div>
              <div className="perf-check">✓ Çözünürlük düşürüldü (1x)</div>
              <div className="perf-check">✓ Render mesafesi kısaltıldı</div>
            </div>
          )}

          <div className="settings-divider" />

          <div className="settings-row">
            <span className="settings-label">📱 Mobil Mod</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={mobileMode} onChange={(e) => { onMobileModeToggle(e.target.checked); localStorage.setItem("mobile_mode", String(e.target.checked)); }} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="settings-row settings-col">
            <span className="settings-label">🎯 Hassasiyet: {sensitivity.toFixed(1)}</span>
            <input
              className="settings-slider"
              type="range" min={0.1} max={5} step={0.1}
              value={sensitivity}
              onChange={(e) => { const v = parseFloat(e.target.value); onSensitivity(v); localStorage.setItem("sensitivity", String(v)); }}
            />
          </div>
          {isFounder && (
            <button className="settings-admin-btn" onClick={() => { onOpenAdmin(); onClose(); }}>
              🛡️ Admin Konsolu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
