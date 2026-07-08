/**
 * UIManager
 * ---------
 * الطبقة الوحيدة المسؤولة عن لمس عناصر DOM وتحديث الواجهة.
 * تُبقي GameEngine وPianoKeyboard خاليين تمامًا من أي منطق عرض،
 * مما يسهّل تبديل أو إعادة تصميم الواجهة مستقبلًا دون المساس بالمنطق.
 */
class UIManager {
  constructor() {
    this.screens = {
      start: document.getElementById("start-screen"),
      game: document.getElementById("game-screen"),
      summary: document.getElementById("summary-screen")
    };

    this.el = {
      startBtn: document.getElementById("start-btn"),
      startBest: document.getElementById("start-best"),
      startLevel: document.getElementById("start-level"),

      hudLevel: document.getElementById("hud-level"),
      hudAccuracy: document.getElementById("hud-accuracy"),
      hudAttempts: document.getElementById("hud-attempts"),
      hudBest: document.getElementById("hud-best"),
      endSessionBtn: document.getElementById("end-session-btn"),

      stageStatusText: document.getElementById("stage-status-text"),
      echoIndicator: document.getElementById("echo-indicator"),
      progressDots: document.getElementById("progress-dots"),

      resultPanel: document.getElementById("result-panel"),

      summaryStats: document.getElementById("summary-stats"),
      replayBtn: document.getElementById("replay-btn")
    };
  }

  /** يعرض شاشة محددة (start / game / summary) ويخفي البقية */
  showScreen(name) {
    Object.values(this.screens).forEach((s) => s.classList.remove("active"));
    this.screens[name].classList.add("active");
  }

  /** يملأ بيانات شاشة البداية (أفضل نتيجة سابقة) */
  fillStartMeta({ bestAccuracy, bestLevel }) {
    this.el.startBest.textContent = bestAccuracy > 0 ? `${bestAccuracy}%` : "—";
    this.el.startLevel.textContent = bestLevel > 1 ? bestLevel : "—";
  }

  /** يحدّث بطاقات لوحة المعلومات أعلى شاشة اللعب */
  updateHUD({ level, accuracy, attempts, best }) {
    this.el.hudLevel.textContent = level;
    this.el.hudAccuracy.textContent = `${accuracy}%`;
    this.el.hudAttempts.textContent = attempts;
    this.el.hudBest.textContent = `${best}%`;
  }

  /**
   * يحدّث نص الحالة ومظهر مؤشر "الصدى" المركزي.
   * @param {string} text
   * @param {"idle"|"listening"|"your-turn"} mode
   */
  setStageStatus(text, mode) {
    this.el.stageStatusText.textContent = text;
    this.el.echoIndicator.classList.remove("mode-idle", "mode-listening", "mode-your-turn");
    this.el.echoIndicator.classList.add(`mode-${mode}`);
  }

  /** يبني نقاط التقدم بعدد نغمات اللحن الحالي */
  buildProgressDots(count) {
    this.el.progressDots.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("span");
      dot.className = "progress-dot";
      this.el.progressDots.appendChild(dot);
    }
  }

  /** يميّز نقطة تقدم معينة أثناء عزف اللحن أو عزف اللاعب */
  markDot(index, state) {
    const dot = this.el.progressDots.children[index];
    if (!dot) return;
    dot.classList.remove("dot-active");
    dot.classList.add(state === "active" ? "dot-active" : "dot-played");
  }

  /** يعيد ضبط كل نقاط التقدم إلى حالتها الأولية */
  resetDots() {
    Array.from(this.el.progressDots.children).forEach((d) => {
      d.classList.remove("dot-active", "dot-played", "dot-correct", "dot-wrong");
    });
  }

  /** يبني نتيجة الجولة كاملة: النجوم، الإحصائيات، ومقارنة اللحنين */
  showResult(result) {
    const starsCount = { perfect: 3, great: 2, good: 1, retry: 0 }[result.rating];
    const titles = { perfect: "ممتاز! 🎉", great: "رائع!", good: "جيد", retry: "حاول مجددًا" };

    const starsHtml = Array.from({ length: 3 })
      .map((_, i) => `<span class="star ${i < starsCount ? "star-filled" : ""}">${i < starsCount ? "⭐" : "☆"}</span>`)
      .join("");

    const comparisonHtml = result.comparison
      .map((row) => {
        const targetName = row.target !== undefined ? PianoKeyboard.midiToNoteName(row.target) : "—";
        const playerName = row.player !== undefined ? PianoKeyboard.midiToNoteName(row.player) : "—";
        const cls = row.correct ? "pill-correct" : "pill-wrong";
        return `
          <div class="compare-col">
            <span class="pill pill-target">${targetName}</span>
            <span class="pill ${cls}">${playerName}</span>
          </div>`;
      })
      .join("");

    this.el.resultPanel.innerHTML = `
      <div class="result-header">
        <div class="result-stars">${starsHtml}</div>
        <h3 class="result-title">${titles[result.rating]}</h3>
      </div>

      <div class="result-stats">
        <div class="result-stat"><span class="stat-num">${result.accuracy}%</span><span class="stat-label">الدقة</span></div>
        <div class="result-stat"><span class="stat-num correct-color">${result.correct}</span><span class="stat-label">صحيحة</span></div>
        <div class="result-stat"><span class="stat-num wrong-color">${result.wrong}</span><span class="stat-label">خاطئة</span></div>
        <div class="result-stat"><span class="stat-num">${(result.timeTakenMs / 1000).toFixed(1)}s</span><span class="stat-label">الوقت</span></div>
      </div>

      <div class="compare-wrap">
        <div class="compare-legend">
          <span><i class="legend-dot legend-target"></i> اللحن الأصلي</span>
          <span><i class="legend-dot legend-correct"></i> صحيح</span>
          <span><i class="legend-dot legend-wrong"></i> خطأ</span>
        </div>
        <div class="compare-row">${comparisonHtml}</div>
      </div>

      <div class="result-actions">
        <button id="retry-btn" class="btn btn-secondary">${result.passed ? "الجولة التالية ←" : "إعادة المحاولة"}</button>
        <button id="finish-btn" class="btn btn-ghost">إنهاء الجلسة</button>
      </div>
    `;

    this.el.resultPanel.classList.remove("hidden");
    this.el.resultPanel.classList.add("panel-enter");
  }

  /** يخفي لوحة النتيجة قبل بدء جولة جديدة */
  hideResult() {
    this.el.resultPanel.classList.add("hidden");
    this.el.resultPanel.classList.remove("panel-enter");
    this.el.resultPanel.innerHTML = "";
  }

  /** يعرض شاشة ملخص الجلسة النهائية */
  showSummary({ level, bestAccuracy, attempts }) {
    this.el.summaryStats.innerHTML = `
      <div class="summary-stat"><span class="stat-num">${level}</span><span class="stat-label">أعلى مستوى</span></div>
      <div class="summary-stat"><span class="stat-num">${bestAccuracy}%</span><span class="stat-label">أفضل دقة</span></div>
      <div class="summary-stat"><span class="stat-num">${attempts}</span><span class="stat-label">عدد المحاولات</span></div>
    `;
    this.showScreen("summary");
  }
}
