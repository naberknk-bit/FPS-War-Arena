/**
 * JARVIS-M Bridge Service  v3.1
 * ================================
 * React köprüsü — jarvis_server_v3.py ile tam uyumlu.
 *
 * Düzeltmeler (v3.0 → v3.1):
 *  - browserControl: /browser_control → /browser  (doğru endpoint)
 *  - browserControl: "dogal_dil" eylem tipi ile Gemini parse tetikleniyor
 *  - konus: /konус → /konus  (ASCII endpoint adı)
 *  - Yeni: aramaYap() — motor + sorgu ile doğrudan arama
 *  - Yeni: urlAc()    — URL aç + sesli onay
 *  - Fallback: Python yoksa window.open ile çalışmaya devam eder
 */

const SUNUCU = 'http://localhost:5000';

type StatusCallback = (online: boolean) => void;
let _statusCallback: StatusCallback | null = null;
let _heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function _setStatus(online: boolean) {
  _statusCallback?.(online);
}

// ── Temel sinyal ───────────────────────────────────────────────────────
export async function sinyal(kod: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${SUNUCU}/sinyal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sinyal: kod }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`[JARVIS] ✓ sinyal(${kod}) →`, data);
    _setStatus(true);
    return data;
  } catch (err) {
    console.warn(`[JARVIS] ✗ sinyal(${kod}):`, err);
    _setStatus(false);
    return null;
  }
}

// ── Sesli okuma ────────────────────────────────────────────────────────
export async function konus(metin: string): Promise<void> {
  try {
    await fetch(`${SUNUCU}/konus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metin }),
    });
  } catch {
    console.warn('[JARVIS] ✗ konus() hatası');
  }
}

// ── Browser — Gemini doğal dil ─────────────────────────────────────────
export async function browserControl(query: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${SUNUCU}/browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eylem: 'dogal_dil', komut: query }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`[JARVIS] ✓ browserControl("${query}") →`, data);
    _setStatus(true);
    return data;
  } catch (err) {
    console.warn(`[JARVIS] ✗ browserControl:`, err);
    _setStatus(false);
    return null;
  }
}

// ── URL aç + sesli onay ────────────────────────────────────────────────
export async function urlAc(url: string, siteAdi: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${SUNUCU}/browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eylem: 'url_ac', url, site_adi: siteAdi }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _setStatus(true);
    return data;
  } catch (err) {
    console.warn(`[JARVIS] ✗ urlAc(${url}):`, err);
    _setStatus(false);
    window.open(url, '_blank');   // fallback
    return null;
  }
}

// ── Motor araması ──────────────────────────────────────────────────────
export async function aramaYap(motor: string, sorgu: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${SUNUCU}/browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eylem: 'arama_yap', motor, sorgu }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _setStatus(true);
    return data;
  } catch (err) {
    console.warn(`[JARVIS] ✗ aramaYap:`, err);
    _setStatus(false);
    const urls: Record<string, string> = {
      youtube:   'https://www.youtube.com/results?search_query=',
      google:    'https://www.google.com/search?q=',
      github:    'https://github.com/search?q=',
      wikipedia: 'https://tr.wikipedia.org/wiki/Special:Search?search=',
    };
    window.open((urls[motor] ?? urls.google) + encodeURIComponent(sorgu), '_blank');
    return null;
  }
}

// ── Durum / heartbeat ──────────────────────────────────────────────────
export async function checkStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${SUNUCU}/durum`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    _setStatus(res.ok);
    return res.ok;
  } catch {
    _setStatus(false);
    return false;
  }
}

export function startHeartbeat(callback: StatusCallback, intervalMs = 5000): () => void {
  _statusCallback = callback;
  checkStatus();
  _heartbeatInterval = setInterval(checkStatus, intervalMs);
  return () => {
    if (_heartbeatInterval) clearInterval(_heartbeatInterval);
    _statusCallback = null;
  };
}

const JARVIS = { sinyal, konus, browserControl, urlAc, aramaYap, checkStatus, startHeartbeat };
export default JARVIS;
