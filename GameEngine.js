/**
 * GameEngine
 * ----------
 * يدير منطق اللعبة بالكامل بمعزل عن واجهة المستخدم:
 *  - توليد الألحان حسب المستوى (طول أطول + نطاق نغمات أوسع)
 *  - ضبط السرعة والفواصل الزمنية (أصعب كلما ارتفع المستوى)
 *  - تسجيل عزف اللاعب وتقييمه مقارنة باللحن الأصلي
 *  - حفظ أفضل نتيجة وعدد المحاولات في localStorage
 */
class GameEngine {
  static SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // سلم دو الكبير (Major Scale)
  static BASE_MIDI = 60; // C4 — مركز النطاق
  static MIN_MIDI = 48;  // C3
  static MAX_MIDI = 79;  // G5
  static STORAGE_KEY = "echoPiano_progress_v1";

  constructor() {
    this.level = 1;
    this.attempts = 0;
    this.bestAccuracy = 0;
    this.bestLevel = 1;

    this.currentMelody = [];
    this.playerNotes = [];
    this.roundStartTime = null;

    this._loadProgress();
  }

  /** يقرأ التقدم المحفوظ سابقًا من التخزين المحلي (إن وُجد) */
  _loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(GameEngine.STORAGE_KEY));
      if (saved) {
        this.bestAccuracy = saved.bestAccuracy ?? 0;
        this.bestLevel = saved.bestLevel ?? 1;
        this.attempts = saved.attempts ?? 0;
      }
    } catch (err) {
      // تجاهل بيانات تالفة أو غير متاحة والبدء من جديد
    }
  }

  /** يحفظ التقدم الحالي في التخزين المحلي */
  _saveProgress() {
    try {
      localStorage.setItem(GameEngine.STORAGE_KEY, JSON.stringify({
        bestAccuracy: this.bestAccuracy,
        bestLevel: this.bestLevel,
        attempts: this.attempts
      }));
    } catch (err) {
      // التخزين قد يكون معطلاً (وضع خاص مثلاً) — لا داعي لإيقاف اللعبة
    }
  }

  /**
   * يبني مجموعة النغمات المسموح استخدامها في هذا المستوى.
   * يتسع النطاق تدريجيًا حول المركز C4 كلما ارتفع المستوى، ويقتصر
   * دائمًا على درجات سلم دو الكبير لضمان لحن سلس ومريح للأذن.
   */
  _buildNotePool(level) {
    const spread = Math.min(GameEngine.MAX_MIDI - GameEngine.MIN_MIDI, 6 + level * 2);
    const low = Math.max(GameEngine.MIN_MIDI, GameEngine.BASE_MIDI - Math.floor(spread / 2));
    const high = Math.min(GameEngine.MAX_MIDI, GameEngine.BASE_MIDI + Math.ceil(spread / 2));

    const pool = [];
    for (let midi = low; midi <= high; midi++) {
      const semitone = ((midi % 12) + 12) % 12;
      if (GameEngine.SCALE_INTERVALS.includes(semitone)) pool.push(midi);
    }
    return pool.length ? pool : [GameEngine.BASE_MIDI];
  }

  /**
   * يولّد لحنًا عشوائيًا مناسبًا للمستوى المُعطى.
   * طول اللحن = رقم المستوى (بحد أقصى 20 نغمة)، مع تفادي تكرار
   * نفس النغمة أكثر من مرتين متتاليتين للحفاظ على تنوّع تدريبي.
   */
  generateMelody(level) {
    const length = Math.min(20, level);
    const pool = this._buildNotePool(level);
    const melody = [];
    let repeatStreak = 0;

    for (let i = 0; i < length; i++) {
      let candidate;
      let attempts = 0;
      do {
        candidate = pool[Math.floor(Math.random() * pool.length)];
        attempts++;
      } while (
        melody.length > 0 &&
        candidate === melody[melody.length - 1] &&
        repeatStreak >= 1 &&
        attempts < 8
      );

      repeatStreak = (melody.length && candidate === melody[melody.length - 1]) ? repeatStreak + 1 : 0;
      melody.push(candidate);
    }

    return melody;
  }

  /**
   * يحسب مدة كل نغمة والفاصل الزمني بينها حسب المستوى.
   * كلما ارتفع المستوى: تقل مدة العزف وتقل فترة الانتظار = تحدٍ أصعب.
   */
  getTempo(level) {
    const noteDuration = Math.max(0.26, 0.75 - level * 0.02); // بالثواني
    const gap = Math.max(0.06, 0.24 - level * 0.008);          // بالثواني
    return { noteDuration, gap };
  }

  /** يبدأ جولة جديدة: يولّد لحنًا ويصفّر حالة عزف اللاعب */
  startRound() {
    this.currentMelody = this.generateMelody(this.level);
    this.playerNotes = [];
    this.roundStartTime = null;
    return this.currentMelody;
  }

  /**
   * يسجّل نغمة عزفها اللاعب.
   * @returns {boolean} true إذا اكتمل عدد النغمات المطلوب (جاهز للتقييم)
   */
  registerPlayerNote(midi) {
    if (this.roundStartTime === null) this.roundStartTime = performance.now();
    this.playerNotes.push(midi);
    return this.playerNotes.length >= this.currentMelody.length;
  }

  /**
   * يقارن لحن اللاعب باللحن الأصلي نغمة بنغمة، ويحسب نتيجة الجولة.
   * @returns {Object} تفاصيل النتيجة الكاملة (نسبة الدقة، عدد الصحيح/الخطأ، التقييم النجمي...)
   */
  evaluate() {
    const target = this.currentMelody;
    const player = this.playerNotes;
    const length = Math.max(target.length, player.length);

    let correct = 0;
    const comparison = [];

    for (let i = 0; i < length; i++) {
      const t = target[i];
      const p = player[i];
      const isCorrect = t !== undefined && p !== undefined && t === p;
      if (isCorrect) correct++;
      comparison.push({ target: t, player: p, correct: isCorrect });
    }

    const accuracy = Math.round((correct / target.length) * 100);
    const timeTakenMs = this.roundStartTime ? Math.round(performance.now() - this.roundStartTime) : 0;

    this.attempts++;
    if (accuracy > this.bestAccuracy) this.bestAccuracy = accuracy;

    let rating;
    if (accuracy === 100) rating = "perfect";
    else if (accuracy >= 80) rating = "great";
    else if (accuracy >= 50) rating = "good";
    else rating = "retry";

    const passed = accuracy >= 50;
    const levelBeforeRound = this.level;

    if (passed) {
      this.level++;
      if (this.level > this.bestLevel) this.bestLevel = this.level;
    }

    this._saveProgress();

    return {
      accuracy,
      correct,
      wrong: target.length - correct,
      timeTakenMs,
      rating,
      passed,
      comparison,
      level: levelBeforeRound
    };
  }

  /** يعيد ضبط الجلسة الحالية للبدء من المستوى الأول (لا يمسح أفضل نتيجة محفوظة) */
  resetSession() {
    this.level = 1;
    this.currentMelody = [];
    this.playerNotes = [];
  }
}
