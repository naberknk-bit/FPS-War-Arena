type Lang = "tr" | "en";

const LINES = {
  kill_normal: {
    tr: [
      "{name} rakibi sahadan sildi!",
      "Temiz vuruş! {name} harikalar yaratıyor!",
      "{name} imha etti! Takım lider!",
      "Mükemmel atış! {name} düşmanı deviriyor!",
      "{name} durdurulamıyor!",
    ],
    en: [
      "{name} takes down the enemy!",
      "Clean kill! {name} is on fire!",
      "Eliminated! {name} is unstoppable!",
    ],
  },
  kill_headshot: {
    tr: [
      "KAFA VURUŞU! {name} inanılmaz!",
      "Muhteşem! Tam hedef! {name}!",
      "{name} kafadan aldı! Seyirci çılgına döndü!",
      "ACE potansiyeli! {name} headshot!",
      "Kafa vuruşu ustası {name}!",
    ],
    en: [
      "HEADSHOT! {name} is incredible!",
      "One tap! {name} shows no mercy!",
      "Brilliant headshot by {name}!",
    ],
  },
  multi_kill: {
    tr: [
      "DOUBLE KILL! {name} gerçek bir savaşçı!",
      "İkili imha! {name} fırtınası!",
    ],
    en: [
      "DOUBLE KILL! {name} is on a rampage!",
    ],
  },
  death: {
    tr: [
      "{name} devrildi! Hızlı dön!",
      "Dikkatli ol {name}! Geri dön!",
      "{name} köşeye sıkıştırıldı!",
    ],
    en: [
      "{name} is down! Get back in there!",
      "Careful {name}! Regroup!",
    ],
  },
  win: {
    tr: [
      "{name} ve takımı zafere ulaştı! Muhteşem!",
      "ZAFER! {name} tarihe geçiyor!",
      "Olağanüstü performans! {name} kazandı!",
    ],
    en: [
      "{name} and the team claim victory! Incredible!",
      "VICTORY! {name} writes history!",
    ],
  },
  loss: {
    tr: [
      "Maç kaybedildi. Ama {name} savaştı!",
      "Başka bir gün gelecek {name}!",
    ],
    en: [
      "Tough match. But {name} fought hard!",
    ],
  },
  spike_plant: {
    tr: [
      "Bomba yerleştirildi! Savunma kritik pozisyonda!",
      "Spike aktif! Takım geri çekil!",
    ],
    en: [
      "Spike planted! Defense is critical!",
    ],
  },
  spike_defuse: {
    tr: [
      "İMHA EDİLDİ! {name} günü kurtardı!",
      "Fenomental! {name} bombayı durdurdu!",
    ],
    en: [
      "DEFUSED! {name} saves the day!",
    ],
  },
  low_hp: {
    tr: [
      "{name} kritik! Sağlık bul!",
      "Tehlike! {name} neredeyse bitti!",
    ],
    en: [
      "{name} is critical! Find health!",
    ],
  },
};

export class Sportscaster {
  private queue: string[]      = [];
  private speaking             = false;
  private voice: SpeechSynthesisVoice | null = null;
  private enabled              = true;
  private playerName           = "Oyuncu";
  private lang: Lang           = "tr";
  private killStreak           = 0;
  private lastKillTime         = 0;

  constructor(playerName: string, lang: Lang = "tr") {
    this.playerName = playerName;
    this.lang       = lang;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const load = () => {
        const voices = window.speechSynthesis.getVoices();
        this.voice   = voices.find(v => v.lang.startsWith(lang === "tr" ? "tr" : "en")) ?? voices[0] ?? null;
      };
      window.speechSynthesis.onvoiceschanged = load;
      load();
    }
  }

  private pick(arr: string[]): string { return arr[Math.floor(Math.random() * arr.length)]; }
  private fmt(template: string): string { return template.replace("{name}", this.playerName); }

  private say(text: string, priority = false) {
    if (!this.enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (priority) this.queue.unshift(text);
    else          this.queue.push(text);
    if (this.queue.length > 3) this.queue.length = 3; // cap queue
    this.processQueue();
  }

  private processQueue() {
    if (this.speaking || this.queue.length === 0) return;
    this.speaking = true;
    const text    = this.queue.shift()!;
    const utter   = new SpeechSynthesisUtterance(text);
    if (this.voice) utter.voice = this.voice;
    utter.rate  = 1.08;
    utter.pitch = 1.05 + Math.random() * 0.1;
    utter.onend = () => { this.speaking = false; this.processQueue(); };
    window.speechSynthesis.speak(utter);
  }

  onKill(isHeadshot: boolean) {
    const now = Date.now();
    if (now - this.lastKillTime < 4000) this.killStreak++;
    else this.killStreak = 1;
    this.lastKillTime = now;

    if (this.killStreak >= 2) {
      const lines = LINES.multi_kill[this.lang];
      this.say(this.fmt(this.pick(lines)), true);
    } else if (isHeadshot) {
      const lines = LINES.kill_headshot[this.lang];
      this.say(this.fmt(this.pick(lines)), true);
    } else {
      const lines = LINES.kill_normal[this.lang];
      this.say(this.fmt(this.pick(lines)));
    }
  }

  onDeath()        { this.killStreak = 0; this.say(this.fmt(this.pick(LINES.death[this.lang]))); }
  onWin()          { this.say(this.fmt(this.pick(LINES.win[this.lang])), true); }
  onLoss()         { this.say(this.fmt(this.pick(LINES.loss[this.lang]))); }
  onSpikePlant()   { this.say(this.pick(LINES.spike_plant[this.lang])); }
  onSpikeDefuse()  { this.say(this.fmt(this.pick(LINES.spike_defuse[this.lang])), true); }
  onLowHp()        { this.say(this.fmt(this.pick(LINES.low_hp[this.lang]))); }

  setEnabled(v: boolean) { this.enabled = v; if (!v && typeof window !== "undefined") window.speechSynthesis.cancel(); }
  isEnabled()            { return this.enabled; }
  setLang(l: Lang)       { this.lang = l; }
  setPlayerName(n: string) { this.playerName = n; }
}
