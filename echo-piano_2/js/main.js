/**
 * main.js
 * -------
 * نقطة الدخول: يربط كل الوحدات ببعضها (المحرك الصوتي، البيانو،
 * منطق اللعبة، وواجهة المستخدم) ويدير حلقة اللعب الكاملة:
 * عزف اللحن → دور اللاعب → التقييم → عرض النتيجة → الجولة التالية.
 */
document.addEventListener("DOMContentLoaded", () => {

  const ui = new UIManager();
  const synth = new PianoSynth();
  const game = new GameEngine();

  const piano = new PianoKeyboard({
    container: document.getElementById("piano"),
    synth,
    startMidi: 48, // C3
    endMidi: 79,   // G5
    onKeyPress: handlePlayerKeyPress
  });

  // قائمة بمعرّفات المؤقتات المجدولة لعزف اللحن (تُستخدم للإلغاء عند الحاجة)
  let scheduledTimeouts = [];

  // ---- تهيئة شاشة البداية ببيانات محفوظة سابقًا ----
  ui.fillStartMeta({ bestAccuracy: game.bestAccuracy, bestLevel: game.bestLevel });

  // ============ ربط الأحداث ============

  ui.el.startBtn.addEventListener("click", async () => {
    await synth.init(); // يجب تفعيل الصوت داخل تفاعل مستخدم مباشر
    ui.showScreen("game");
    refreshHud();
    beginRound();
  });

  ui.el.endSessionBtn.addEventListener("click", endSession);

  ui.el.replayBtn.addEventListener("click", () => {
    game.resetSession();
    ui.showScreen("game");
    refreshHud();
    beginRound();
  });

  // تفويض الأحداث: أزرار لوحة النتيجة تُنشأ ديناميكيًا، لذا نستمع من الحاوية الأم
  ui.el.resultPanel.addEventListener("click", (e) => {
    if (e.target.id === "retry-btn") {
      ui.hideResult();
      beginRound();
    } else if (e.target.id === "finish-btn") {
      endSession();
    }
  });

  // ============ حلقة اللعب ============

  /** يحدّث بطاقات لوحة المعلومات لتعكس حالة المحرك الحالية */
  function refreshHud() {
    ui.updateHUD({
      level: game.level,
      accuracy: game.bestAccuracy,
      attempts: game.attempts,
      best: game.bestAccuracy
    });
  }

  /** يبدأ جولة جديدة: يولّد لحنًا ويعزفه تلقائيًا ثم يفتح البيانو للاعب */
  function beginRound() {
    clearScheduledPlayback();
    piano.lock();
    ui.hideResult();

    const melody = game.startRound();
    ui.buildProgressDots(melody.length);
    ui.setStageStatus("استعد... 🎧", "idle");

    const { noteDuration, gap } = game.getTempo(game.level);
    const stepMs = (noteDuration + gap) * 1000;
    let cursor = 700; // تأخير بسيط قبل انطلاق أول نغمة، يمنح اللاعب لحظة تركيز

    // ملاحظة مهمة: أثناء عزف اللحن الأصلي لا تُضاء أي مفاتيح ولا تُستخدم
    // piano.highlightKey() هنا عن قصد — اللعبة تعتمد كليًا على الاستماع،
    // ونقاط التقدم أدناه تعكس فقط "أي نغمة في الترتيب" وليس "أي مفتاح بالصوت".
    melody.forEach((midi, index) => {
      const timeoutId = setTimeout(() => {
        ui.setStageStatus("استمع جيدًا…", "listening");
        ui.markDot(index, "active");
        synth.playNote(PianoKeyboard.midiToNoteName(midi), noteDuration);
        setTimeout(() => ui.markDot(index, "played"), noteDuration * 1000);
      }, cursor);
      scheduledTimeouts.push(timeoutId);
      cursor += stepMs;
    });

    const enablePlayerTimeout = setTimeout(() => {
      ui.resetDots();
      ui.buildProgressDots(melody.length);
      ui.setStageStatus("الآن دورك! أعِد عزف اللحن 🎹", "your-turn");
      piano.unlock();
    }, cursor + 300);
    scheduledTimeouts.push(enablePlayerTimeout);
  }

  /** يُستدعى في كل مرة يضغط فيها اللاعب مفتاحًا أثناء دوره */
  function handlePlayerKeyPress(midi) {
    const dotIndex = game.playerNotes.length; // الفهرس قبل الإضافة
    const roundComplete = game.registerPlayerNote(midi);

    ui.markDot(dotIndex, "played");

    if (roundComplete) {
      piano.lock();
      ui.setStageStatus("جاري التقييم…", "idle");

      // تأخير بسيط يمنح إحساسًا طبيعيًا بمعالجة النتيجة قبل ظهورها
      setTimeout(() => {
        const result = game.evaluate();
        refreshHud();
        ui.setStageStatus(
          result.passed ? "أحسنت! انتقلت إلى مستوى جديد 🎉" : "لم تكتمل الدقة الكافية بعد",
          "idle"
        );
        ui.showResult(result);
      }, 350);
    }
  }

  /** يلغي أي عزف مجدول للحن (يُستخدم عند بدء جولة جديدة فوق أخرى) */
  function clearScheduledPlayback() {
    scheduledTimeouts.forEach(clearTimeout);
    scheduledTimeouts = [];
  }

  /** ينهي الجلسة الحالية ويعرض شاشة الملخص النهائي */
  function endSession() {
    clearScheduledPlayback();
    piano.lock();
    ui.showSummary({
      level: game.bestLevel,
      bestAccuracy: game.bestAccuracy,
      attempts: game.attempts
    });
  }

  // إعادة بناء لوحة المفاتيح عند تغيّر حجم الشاشة بشكل ملحوظ (مثل تدوير الجهاز)
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => piano.rebuild(), 200);
  });
});
