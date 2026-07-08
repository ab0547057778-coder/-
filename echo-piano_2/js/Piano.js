/**
 * PianoKeyboard
 * -------------
 * يبني لوحة مفاتيح بيانو تفاعلية (أبيض/أسود) داخل عنصر حاوٍ،
 * ويربطها بمحرك الصوت PianoSynth. تدعم الفأرة واللمس، وتوفر
 * دوال للتحكم البرمجي (تمييز مفتاح أثناء عزف اللحن، قفل/فتح الإدخال).
 */
class PianoKeyboard {
  /**
   * @param {Object} config
   * @param {HTMLElement} config.container - عنصر الحاوية
   * @param {PianoSynth} config.synth - محرك الصوت
   * @param {number} [config.startMidi] - أدنى رقم MIDI في النطاق
   * @param {number} [config.endMidi] - أعلى رقم MIDI في النطاق
   * @param {(midi:number, note:string)=>void} [config.onKeyPress] - يُستدعى عند ضغط المستخدم لمفتاح
   */
  constructor({ container, synth, startMidi = 48, endMidi = 79, onKeyPress }) {
    this.container = container;
    this.synth = synth;
    this.startMidi = startMidi;
    this.endMidi = endMidi;
    this.onKeyPress = onKeyPress || (() => {});
    this.locked = true;
    this.keyElements = new Map(); // midi -> HTMLElement

    this._render();
    this._bindEvents();
  }

  /** يحوّل رقم MIDI إلى اسم نغمة علمي مثل "C#4" (يُستخدم لتشغيل الصوت عبر Tone.js) */
  static midiToNoteName(midi) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = Math.floor(midi / 12) - 1;
    return `${names[((midi % 12) + 12) % 12]}${octave}`;
  }

  /** يحوّل رقم MIDI إلى اسم درجة السلم فقط بدون رقم الأوكتاف، مثل "C#" (يُستخدم كتسمية مرئية على المفتاح) */
  static midiToPitchClassName(midi) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    return names[((midi % 12) + 12) % 12];
  }

  /** يحدد ما إذا كانت النغمة مفتاحًا أسود */
  static isBlackKey(midi) {
    return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
  }

  /** يقرأ عرض المفتاح الأبيض الحالي من متغيرات CSS (يتغيّر حسب حجم الشاشة) */
  _whiteKeyWidth() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--white-key-width");
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 44;
  }

  /** يبني عناصر DOM للوحة المفاتيح كاملة */
  _render() {
    this.container.innerHTML = "";
    this.keyElements.clear();

    const whiteWrap = document.createElement("div");
    whiteWrap.className = "keys-white";

    const blackWrap = document.createElement("div");
    blackWrap.className = "keys-black";

    const whiteKeyWidth = this._whiteKeyWidth();
    const blackKeyWidth = whiteKeyWidth * 0.6;

    let whiteCount = 0;

    for (let midi = this.startMidi; midi <= this.endMidi; midi++) {
      const noteName = PianoKeyboard.midiToNoteName(midi);
      const isBlack = PianoKeyboard.isBlackKey(midi);

      const keyEl = document.createElement("button");
      keyEl.type = "button";
      keyEl.className = isBlack ? "key key-black" : "key key-white";
      keyEl.dataset.midi = String(midi);
      keyEl.dataset.note = noteName;
      keyEl.setAttribute("aria-label", `مفتاح ${noteName}`);

      // تسمية اسم درجة السلم على المفتاح (بدون رقم الأوكتاف) — تتكرر عبر كل الأوكتافات
      // حتى يتعرف اللاعب على موضع النغمات، لكنها لا تكشف أبدًا أي نغمة يتم عزفها آليًا
      const labelEl = document.createElement("span");
      labelEl.className = "key-label";
      labelEl.textContent = PianoKeyboard.midiToPitchClassName(midi);
      keyEl.appendChild(labelEl);

      if (isBlack) {
        const offset = whiteCount * whiteKeyWidth - blackKeyWidth / 2;
        keyEl.style.left = `${offset}px`;
        keyEl.style.width = `${blackKeyWidth}px`;
        blackWrap.appendChild(keyEl);
      } else {
        keyEl.style.width = `${whiteKeyWidth}px`;
        whiteWrap.appendChild(keyEl);
        whiteCount++;
      }

      this.keyElements.set(midi, keyEl);
    }

    this.container.appendChild(whiteWrap);
    this.container.appendChild(blackWrap);
  }

  /** يربط أحداث الفأرة/اللمس بكل مفتاح عبر Pointer Events (يدعم الاثنين معًا) */
  _bindEvents() {
    this.keyElements.forEach((keyEl, midi) => {
      keyEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (this.locked) return;
        this._handleUserPress(midi);
      });
    });
  }

  /** يُنفَّذ عند ضغط المستخدم الفعلي لمفتاح (وليس التمييز البرمجي) */
  _handleUserPress(midi) {
    const noteName = PianoKeyboard.midiToNoteName(midi);
    this.synth.playNote(noteName, 0.55);
    this._flashKey(midi, "key-pressed", 160);
    this.onKeyPress(midi, noteName);
  }

  /** يضيء مفتاحًا لفترة قصيرة (تُستخدم لعزف/ضغط المفاتيح) */
  _flashKey(midi, className, durationMs) {
    const keyEl = this.keyElements.get(midi);
    if (!keyEl) return;
    keyEl.classList.add(className);
    setTimeout(() => keyEl.classList.remove(className), durationMs);
  }

  /**
   * يميّز مفتاحًا برمجيًا بتوهج بصري. هذه الدالة متاحة للاستخدام المستقبلي
   * (مثل وضع "مراجعة" اختياري بعد انتهاء الجولة)، لكنها عمدًا غير مُستخدمة
   * أثناء تشغيل اللحن الأصلي في اللعبة الحالية — لأن اللعبة تعتمد كليًا على
   * الاستماع، ولا يجوز أن يكشف أي مؤشر بصري أي نغمة يتم عزفها آليًا.
   * @param {number} midi
   * @param {number} durationMs
   */
  highlightKey(midi, durationMs = 400) {
    this._flashKey(midi, "key-glow", durationMs);
  }

  /** يمنع اللاعب من الضغط على المفاتيح (أثناء عزف اللحن الأصلي أو التقييم) */
  lock() {
    this.locked = true;
    this.container.classList.add("piano-locked");
  }

  /** يسمح للاعب بالضغط على المفاتيح (دوره في إعادة عزف اللحن) */
  unlock() {
    this.locked = false;
    this.container.classList.remove("piano-locked");
  }

  /** يعيد بناء اللوحة (مفيد عند تغيّر حجم الشاشة بشكل كبير) */
  rebuild() {
    this._render();
    this._bindEvents();
  }
}
