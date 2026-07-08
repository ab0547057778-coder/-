/**
 * PianoSynth
 * ----------
 * يبني صوت بيانو واقعيًا بالكامل عبر توليف Tone.js (بدون ملفات صوتية جاهزة).
 *
 * الفكرة الصوتية:
 *  - طبقة "الوتر" الأساسية: موجة مثلثية متعددة (fatriangle) مع تلاشي (decay)
 *    سريع نسبيًا يحاكي طبيعة تلاشي وتر البيانو الحقيقي.
 *  - طبقة "ضربة المطرقة": نغمة قصيرة جدًا وعالية التردد تُضاف عند بداية
 *    كل نغمة لإعطاء إحساس "القرع" المميز لآلة البيانو.
 *  - Reverb + Compressor + EQ لإعطاء عمق ودفء يقربان الصوت من بيانو حقيقي
 *    يُعزف داخل قاعة صغيرة.
 */
class PianoSynth {
  constructor() {
    this._ready = false;
    this._buildSignalChain();
  }

  /** ينشئ سلسلة المعالجة الصوتية والأصوات المولّدة */
  _buildSignalChain() {
    // صدى خفيف يحاكي رنين صندوق البيانو والغرفة
    this.reverb = new Tone.Reverb({ decay: 2.2, preDelay: 0.02, wet: 0.22 }).toDestination();

    // ضاغط لطيف يوحّد شدة الأصوات كما تفعل آلية البيانو الميكانيكية
    this.compressor = new Tone.Compressor({ threshold: -22, ratio: 3, attack: 0.008, release: 0.18 });

    // تعديل ترددي يقلل من حدة الطبقات العليا ويضيف دفئًا للمنتصف
    this.eq = new Tone.EQ3({ low: 1.5, mid: 0.5, high: -3.5 });

    // الصوت الأساسي: يمثل اهتزاز الوتر بعد الضربة
    this.bodySynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fattriangle", count: 3, spread: 18 },
      envelope: { attack: 0.004, decay: 1.1, sustain: 0.04, release: 0.9 }
    });

    // طبقة إضافية خفيفة جدًا تحاكي "طقة" ضرب المطرقة على الوتر
    this.hammerLayer = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.04 },
      volume: -26
    });

    this.bodySynth.chain(this.eq, this.compressor, this.reverb);
    this.hammerLayer.chain(this.compressor, this.reverb);
  }

  /**
   * يجهّز محرك الصوت — يجب استدعاؤها داخل تفاعل مستخدم مباشر
   * (مثل ضغط زر) لأن المتصفحات تمنع تشغيل الصوت تلقائيًا.
   */
  async init() {
    if (this._ready) return;
    await Tone.start();
    this._ready = true;
  }

  /**
   * يعزف نغمة واحدة.
   * @param {string} note - اسم النغمة العلمي مثل "C4" أو "F#3"
   * @param {number|string} duration - المدة بالثواني أو بصيغة Tone (مثل "8n")
   * @param {number} [time] - وقت التشغيل المجدول (اختياري، الافتراضي الآن)
   */
  playNote(note, duration = 0.5, time) {
    const playTime = time !== undefined ? time : Tone.now();
    this.bodySynth.triggerAttackRelease(note, duration, playTime);
    this.hammerLayer.triggerAttackRelease(note, 0.03, playTime);
  }

  /** يوقف كل الأصوات الحالية فورًا (يُستخدم عند إعادة الضبط) */
  releaseAll() {
    this.bodySynth.releaseAll();
  }
}
