"use strict";

/* ============================= DATA ============================= */

const VERSE = {
  text: "וַיּוֹצֵא אֹתוֹ הַחוּצָה וַיֹּאמֶר הַבֶּט־נָא הַשָּׁמַיְמָה וּסְפֹר הַכּוֹכָבִים אִם־תּוּכַל לִסְפֹּר אֹתָם וַיֹּאמֶר לוֹ כֹּה יִהְיֶה זַרְעֶךָ",
  ref: "בראשית ט״ו, ה׳",
};

const INTRO_TEXT = [
  "אברהם הכיר היטב את שמי הלילה ואת מראה הכוכבים.",
  "ובכל זאת, ה׳ אינו מסתפק בהבטחה מילולית. הוא מבקש מאברהם לצאת מן האוהל, להביט בשמים ולחוות את ההבטחה באמצעות מעשה.",
  "מדוע? מה מבטאת היציאה החוצה?",
  "רש״י מציע שלוש תשובות, וכל אחת מהן מוסיפה רובד נוסף להבנת המעשה.",
  "עברו בין שלוש התחנות לפי הסדר וגלו: בכל פירוש — ממה אברהם יוצא החוצה?",
];

const STATION_META = [
  { name: "החוצה מן האוהל", short: "החוצה מן האוהל." },
  { name: "החוצה מן הגורל שנכתב בכוכבים", short: "החוצה מן הגורל שנכתב בכוכבים." },
  { name: "החוצה ממערכת הכוכבים כולה", short: "החוצה ממערכת הכוכבים כולה." },
];

const LONG_INSIGHTS = [
  "ה׳ הוציא את אברהם מן האוהל כדי שיראה המחשה מוחשית להבטחה.",
  "ה׳ הוציא את אברהם מן המחשבה שהגורל שנכתב לו בכוכבים אינו יכול להשתנות.",
  "ה׳ הוציא את אברהם אל מעל מערכת הכוכבים כדי ללמד שהבטחתו אינה כפופה לחוקי הטבע והמזל.",
];

const FINAL_SUMMARY_QUESTION = {
  question: "מהו הרעיון המשותף לשלושת פירושי רש״י?",
  options: [
    "בכל הפירושים ה׳ מלמד את אברהם עובדות חדשות על מבנה השמים והכוכבים.",
    "כל פירוש מעניק משמעות אחרת למעשה היציאה, ובכל שלב אברהם יוצא מגבול עמוק יותר.",
    "כל הפירושים קובעים שאברהם יצא בפועל למקום אחר מחוץ לעולם.",
    "שלושת הפירושים מציעים תשובות סותרות, ולכן יש לבחור רק אחד מהם.",
  ],
  correctIndex: 1,
  feedback: "בכל פירוש המילה \"החוצה\" מקבלת משמעות עמוקה יותר: החוצה מן האוהל, החוצה מן הגורל שנכתב בכוכבים, והחוצה ממערכת הכוכבים והטבע כולה.",
};

const FINAL_QUOTE = "כדי להאמין בהבטחה, אברהם אינו נדרש רק להביט החוצה — הוא נדרש לצאת מן הגבולות של מה שנראה לו אפשרי.";

/* Silhouette figure (from the back, no facial detail) */
const FIGURE_SVG = `<svg viewBox="0 0 34 62" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="17" cy="9" rx="7" ry="8" fill="#0a0d1e"/>
  <path d="M17 15 C 6 18, 2 30, 4 62 L 30 62 C 32 30, 28 18, 17 15 Z" fill="#0a0d1e"/>
</svg>`;

/* ============================= STATE ============================= */

const STORAGE_KEY = "hachutza-progress-v1";

function defaultState() {
  return {
    screen: "intro", // intro | map | station | summary
    stationIndex: 0, // 0,1,2
    stepIndex: 0,
    completed: [false, false, false],
    insights: [null, null, null],
    order: null, // saved order attempt for summary task
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* ignore quota / privacy-mode errors */
  }
}

/* ============================= STARFIELD ============================= */

function buildStarfield() {
  const field = document.getElementById("starfield");
  const count = window.innerWidth < 480 ? 70 : 130;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const size = Math.random() * 2 + 1;
    s.style.width = size + "px";
    s.style.height = size + "px";
    s.style.top = Math.random() * 100 + "%";
    s.style.left = Math.random() * 100 + "%";
    s.style.animationDuration = 2 + Math.random() * 3.5 + "s";
    s.style.animationDelay = Math.random() * 4 + "s";
    frag.appendChild(s);
  }
  field.appendChild(frag);
}

/* ============================= APP SHELL ============================= */

const app = document.getElementById("app");
const topbar = document.getElementById("topbar");
const progressDots = document.getElementById("progressDots");

function render() {
  saveState();
  updateTopbar();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  if (state.screen === "intro") return renderIntro();
  if (state.screen === "map") return renderMap();
  if (state.screen === "station") return renderStationScreen();
  if (state.screen === "summary") return renderSummary();
}

function updateTopbar() {
  if (state.screen === "intro") {
    topbar.classList.add("hidden");
    return;
  }
  topbar.classList.remove("hidden");
  progressDots.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const d = document.createElement("div");
    d.className = "dot";
    if (state.completed[i]) d.classList.add("done");
    else if (state.screen === "station" && state.stationIndex === i) d.classList.add("active");
    progressDots.appendChild(d);
  }
  if (state.screen === "summary") {
    const d = document.createElement("div");
    d.className = "dot done";
    progressDots.appendChild(d);
  }
}

function setScreen(screen, extra) {
  state.screen = screen;
  Object.assign(state, extra || {});
  render();
}

/* ============================= INTRO SCREEN ============================= */

function renderIntro() {
  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "screen";

  wrap.innerHTML = `
    <div class="intro-badge">בראשית ט״ו — משימה אינטראקטיבית</div>
    <h1>וַיּוֹצֵא אֹתוֹ הַחוּצָה</h1>
    <div class="card">
      <div class="verse">${VERSE.text}</div>
      <div class="verse-ref">${VERSE.ref}</div>
    </div>
    <div class="card">
      ${INTRO_TEXT.map((p) => `<p>${p}</p>`).join("")}
    </div>
  `;

  const btnRow = document.createElement("div");
  btnRow.className = "btn-row";
  const startBtn = document.createElement("button");
  startBtn.className = "btn";
  startBtn.textContent = hasProgress() ? "המשיכו למסע" : "התחילו את המסע";
  startBtn.addEventListener("click", () => setScreen("map"));
  btnRow.appendChild(startBtn);

  if (hasProgress()) {
    const resetBtn = document.createElement("button");
    resetBtn.className = "btn ghost";
    resetBtn.textContent = "התחילו מחדש";
    resetBtn.addEventListener("click", () => {
      state = defaultState();
      render();
    });
    btnRow.appendChild(resetBtn);
  }

  wrap.appendChild(btnRow);
  app.appendChild(wrap);
}

function hasProgress() {
  return state.completed.some(Boolean);
}

/* ============================= MAP SCREEN ============================= */

function renderMap() {
  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "screen";

  wrap.innerHTML = `
    <div class="eyebrow">למה ה׳ מוציא את אברהם החוצה?</div>
    <h2>שלוש תחנות בדרך אל השמים</h2>
    <p class="muted">עברו בין התחנות לפי הסדר. בכל תחנה תגלו פירוש נוסף למילה "החוצה".</p>
  `;

  const list = document.createElement("div");
  list.className = "station-map";

  STATION_META.forEach((meta, i) => {
    const locked = i > 0 && !state.completed[i - 1];
    const done = state.completed[i];
    const node = document.createElement("div");
    node.className = "station-node" + (locked ? " locked" : "") + (done ? " done" : "");
    node.innerHTML = `
      <div class="station-star">${done ? "⭐" : locked ? "🔒" : "✨"}</div>
      <div class="info">
        <div class="num">תחנה ${i + 1}</div>
        <div class="name">${meta.name}</div>
        ${done ? `<div class="insight">"${state.insights[i] || meta.short}"</div>` : ""}
      </div>
    `;
    if (!locked) {
      node.addEventListener("click", () => {
        setScreen("station", { stationIndex: i, stepIndex: 0 });
      });
    }
    list.appendChild(node);
  });

  wrap.appendChild(list);

  if (state.completed.every(Boolean)) {
    const row = document.createElement("div");
    row.className = "btn-row";
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "למשימת הסיום";
    btn.addEventListener("click", () => setScreen("summary"));
    row.appendChild(btn);
    wrap.appendChild(row);
  }

  app.appendChild(wrap);
}

/* ============================= SHARED UI HELPERS ============================= */

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function renderMCQ(container, opts) {
  const box = document.createElement("div");
  box.className = "card";
  const q = document.createElement("p");
  q.style.fontWeight = "700";
  q.style.fontSize = "1.05rem";
  q.textContent = opts.question;
  box.appendChild(q);

  const list = document.createElement("div");
  list.className = "mcq-options";
  let answered = false;

  opts.options.forEach((optText, idx) => {
    const b = document.createElement("button");
    b.className = "mcq-option";
    b.textContent = optText;
    b.addEventListener("click", () => {
      if (idx === opts.correctIndex) {
        answered = true;
        Array.from(list.children).forEach((c) => (c.disabled = true));
        b.classList.add("correct");
        showFeedback(box, true, opts.feedback);
        const nextBtn = document.createElement("button");
        nextBtn.className = "btn";
        nextBtn.style.marginTop = "16px";
        nextBtn.textContent = opts.nextLabel || "המשך";
        nextBtn.addEventListener("click", opts.onNext);
        box.appendChild(nextBtn);
      } else {
        b.classList.add("wrong");
        showFeedback(box, false, "לא בדיוק — נסו לקרוא שוב את השאלה ולבחור תשובה אחרת.");
      }
    });
    list.appendChild(b);
  });

  box.appendChild(list);
  container.appendChild(box);
}

function showFeedback(box, good, text) {
  let fb = box.querySelector(".feedback");
  if (!fb) {
    fb = document.createElement("div");
    fb.className = "feedback";
    box.insertBefore(fb, box.querySelector(".btn"));
  }
  fb.className = "feedback " + (good ? "good" : "bad");
  fb.textContent = text;
}

function renderRashi(container, opts) {
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `
    <div class="eyebrow">לשון רש״י</div>
    <div class="rashi-block">${opts.text}</div>
  `;
  if (opts.glossary && opts.glossary.length) {
    const g = document.createElement("div");
    g.className = "glossary";
    opts.glossary.forEach(([term, def]) => {
      const row = document.createElement("div");
      row.className = "term";
      row.innerHTML = `<b>${term}</b> — ${def}`;
      g.appendChild(row);
    });
    box.appendChild(g);
  }
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.style.marginTop = "16px";
  btn.textContent = "המשך";
  btn.addEventListener("click", opts.onNext);
  box.appendChild(btn);
  container.appendChild(box);
}

function normalizeAnswer(s) {
  return s.trim().replace(/["'׳״]/g, "").replace(/\s+/g, " ");
}

function renderClosing(container, opts) {
  // opts: {promptHtml, blanksAccepted: [[...],[...]], insightText, stationIndex, onComplete}
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<div class="eyebrow">חתימת התחנה</div>`;

  const fillWrap = document.createElement("div");
  fillWrap.className = "fill-blank";
  const parts = opts.promptTemplate.split("____");
  const inputs = [];
  parts.forEach((part, i) => {
    fillWrap.appendChild(document.createTextNode(part));
    if (i < parts.length - 1) {
      const input = document.createElement("input");
      input.type = "text";
      input.setAttribute("aria-label", "השלימו את החסר");
      inputs.push(input);
      fillWrap.appendChild(input);
    }
  });
  box.appendChild(fillWrap);

  const checkBtn = document.createElement("button");
  checkBtn.className = "btn";
  checkBtn.textContent = "בדקו תשובה";
  box.appendChild(checkBtn);

  checkBtn.addEventListener("click", () => {
    const allCorrect = inputs.every((input, i) => {
      const val = normalizeAnswer(input.value);
      return opts.blanksAccepted[i].some((accepted) => val === normalizeAnswer(accepted));
    });

    if (!allCorrect) {
      showFeedback(box, false, "כמעט! נסו שוב — עיינו בשלבים הקודמים אם צריך רמז.");
      return;
    }

    inputs.forEach((i) => (i.disabled = true));
    checkBtn.disabled = true;
    showFeedback(box, true, "כל הכבוד!");

    const insight = document.createElement("div");
    insight.className = "insight-sentence";
    insight.innerHTML = `<span class="tag">משפט התובנה שגיליתם</span>${opts.insightText}`;
    box.appendChild(insight);

    state.insights[opts.stationIndex] = STATION_META[opts.stationIndex].short;
    state.completed[opts.stationIndex] = true;
    saveState();

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn";
    nextBtn.style.marginTop = "16px";
    nextBtn.textContent = opts.stationIndex < 2 ? "חזרה למפה" : "למשימת הסיכום";
    nextBtn.addEventListener("click", opts.onComplete);
    box.appendChild(nextBtn);
  });

  container.appendChild(box);
}

function stationHeader(wrap, stationIdx, subtitle) {
  wrap.innerHTML = `
    <div class="eyebrow">תחנה ${stationIdx + 1} מתוך 3</div>
    <h2>${STATION_META[stationIdx].name}</h2>
    ${subtitle ? `<p class="muted">${subtitle}</p>` : ""}
  `;
}

/* ============================= STATION SCREEN DISPATCH ============================= */

function renderStationScreen() {
  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "screen";
  app.appendChild(wrap);

  if (state.stationIndex === 0) return renderStation1(wrap, state.stepIndex);
  if (state.stationIndex === 1) return renderStation2(wrap, state.stepIndex);
  if (state.stationIndex === 2) return renderStation3(wrap, state.stepIndex);
}

function goStep(delta) {
  state.stepIndex += delta;
  render();
}

function backToMap() {
  setScreen("map");
}

/* ============================= STATION 1 — מן האוהל ============================= */

function renderStation1(wrap, step) {
  stationHeader(wrap, 0, "החוצה — ממה?");

  if (step === 0) {
    const scene = el(`
      <div class="scene">
        <div class="sky"></div>
        <div class="tent-flap"></div>
        <div class="figure">${FIGURE_SVG}</div>
        <div class="scene-btn-wrap"><button class="btn">צאו מן האוהל והביטו בשמים</button></div>
        <div class="caption">אתם בתוך האוהל. מבעד לפתח נראה רק חלק קטן משמי הלילה.</div>
      </div>
    `);
    wrap.appendChild(scene);
    scene.querySelector("button").addEventListener("click", () => {
      scene.classList.add("opened");
      scene.querySelector(".caption").textContent = "השמים נחשפים במלואם, מלאים בכוכבים.";
      const cont = document.createElement("div");
      cont.className = "btn-row";
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = "המשך";
      b.addEventListener("click", () => goStep(1));
      cont.appendChild(b);
      wrap.appendChild(cont);
    });
    return;
  }

  if (step === 1) {
    const box = el(`
      <div class="card">
        <p style="font-weight:700;">נסו לספור את הכוכבים.</p>
        <div id="starCounter" style="font-size:2.2rem; text-align:center; color:var(--gold); font-weight:800; padding:10px 0;">0</div>
        <p class="muted" id="starCaption" style="text-align:center;">סופרים...</p>
      </div>
    `);
    wrap.appendChild(box);
    const counter = box.querySelector("#starCounter");
    const caption = box.querySelector("#starCaption");
    let n = 0;
    const timer = setInterval(() => {
      n += Math.ceil(Math.random() * 40) + 10;
      counter.textContent = n.toLocaleString("he");
      if (n > 400) {
        clearInterval(timer);
        counter.textContent = "אינספור...";
        caption.textContent = "אי אפשר להשלים את הספירה.";
        const mcqHolder = document.createElement("div");
        wrap.appendChild(mcqHolder);
        renderMCQ(mcqHolder, {
          question: "מה תורמת ההתבוננות בכוכבים להבנת הבטחת ה׳?",
          options: [
            "היא מעניקה לאברהם מידע אסטרונומי שלא היה יכול לדעת קודם.",
            "היא הופכת את ההבטחה המופשטת על ריבוי הזרע למראה מוחשי שאברהם יכול לחוות.",
            "היא מוכיחה שמספר צאצאיו של אברהם יהיה זהה בדיוק למספר הכוכבים.",
            "היא מלמדת שהבטחת הזרע תלויה ביכולתו של אברהם להשלים את הספירה.",
          ],
          correctIndex: 1,
          feedback: "אברהם ידע כיצד נראים הכוכבים. מטרת המעשה אינה ללמד אותו עובדה חדשה על השמים, אלא להפוך את ההבטחה לחוויה מוחשית: כפי שהכוכבים רבים מכדי לספור אותם, כך יהיה זרעו רב.",
          onNext: () => goStep(1),
        });
      }
    }, 220);
    return;
  }

  if (step === 2) {
    renderRashi(wrap, {
      text: "לפי פשוטו הוציאו מאהלו לחוץ לראות הכוכבים.",
      glossary: [
        ["לפי פשוטו", "לפי המשמעות הישירה והפשוטה של הפסוק."],
        ["מאהלו לחוץ", "יציאה ממשית מתוך האוהל אל השטח הפתוח."],
      ],
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 3) {
    renderMCQ(wrap, {
      question: "מדוע, לפי הפירוש הראשון, ה׳ אינו מסתפק באמירת ההבטחה?",
      options: [
        "מפני שאברהם אינו מסוגל להבין הבטחות הנאמרות במילים.",
        "מפני שהמראה המוחשי מאפשר לאברהם לחוות את גודל ההבטחה ולא רק לשמוע עליה.",
        "מפני שההבטחה אינה תקפה כל עוד אברהם נשאר בתוך האוהל.",
        "מפני שה׳ מבקש לבדוק אם אברהם מכיר את מראה הכוכבים.",
      ],
      correctIndex: 1,
      feedback: "היציאה החוצה הופכת את ההבטחה ממילים נאמרות לחוויה שאברהם רואה ומרגיש בעצמו.",
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 4) {
    renderClosing(wrap, {
      promptTemplate: "לפי הפירוש הראשון, ה׳ הוציא את אברהם החוצה מן ה____.",
      blanksAccepted: [["האוהל", "אוהל"]],
      insightText: "אברהם יוצא מן האוהל כדי לראות בעיניו המחשה מוחשית להבטחה.",
      stationIndex: 0,
      onComplete: backToMap,
    });
    return;
  }
}

/* ============================= STATION 2 — מן הגורל ============================= */

function renderStation2(wrap, step) {
  stationHeader(wrap, 1, "החוצה — ממה?");

  if (step === 0) {
    const scene = el(`
      <div class="scene revealed">
        <div class="sky"></div>
        <div class="constellation-label">מפת כוכבים עתיקה</div>
        <div class="fate-text" id="fateText">אַבְרָם — לֹא יִהְיֶה לְךָ בֵּן</div>
        <div class="caption">מה אברם חושב שקרא בכוכבים?</div>
      </div>
    `);
    wrap.appendChild(scene);
    const row = document.createElement("div");
    row.className = "btn-row";
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = "המשך";
    b.addEventListener("click", () => goStep(1));
    row.appendChild(b);
    wrap.appendChild(row);
    return;
  }

  if (step === 1) {
    renderMCQ(wrap, {
      question: "מהי ההנחה העומדת מאחורי הקריאה של אברהם בכוכבים?",
      options: [
        "הכוכבים מתארים אפשרות אחת מתוך אפשרויות רבות שאברהם רשאי לבחור ביניהן.",
        "הכוכבים משקפים גורל שנקבע לאדם מראש ושאינו נתון לשינוי.",
        "הכוכבים מראים רק את המתרחש בהווה ואינם קשורים לעתיד.",
        "הכוכבים משפיעים על שמו של האדם, אך לא על עתידו.",
      ],
      correctIndex: 1,
      feedback: "אברהם חושב שקרא בכוכבים את גורלו: שלא יהיה לו בן. מבחינתו, הדבר אינו רק אפשרות אלא עתיד שכבר נכתב ונקבע.",
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 2) {
    renderMCQ(wrap, {
      question: 'כאשר אומרים שדבר מסוים "כתוב בכוכבים", מה משתמע מכך?',
      options: [
        "שהדבר נקבע מראש ונראה כאילו אין לאדם אפשרות לשנותו.",
        "שהדבר מופיע בשמים בכתב ממשי שכל אדם יכול לקרוא.",
        "שהדבר תלוי רק במעשיו ובהחלטותיו של האדם.",
        "שהדבר אינו קשור לעתיד אלא לתופעת טבע המתרחשת בהווה.",
      ],
      correctIndex: 0,
      feedback: 'הביטוי "כתוב בכוכבים" מבטא גורל שנראה קבוע וסגור, שאין לאדם שליטה עליו.',
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 3) {
    renderRashi(wrap, {
      text: "אמר לו: צא מאצטגנינות שלך, שראית במזלות שאינך עתיד להעמיד בן.\nאברם אין לו בן, אבל אברהם יש לו בן.\nוכן שרי לא תלד, אבל שרה תלד.\nאני קורא לכם שם אחר וישתנה המזל.",
      glossary: [
        ["אצטגנינות", "ניסיון ללמוד מן הכוכבים והמזלות מה צפוי לאדם בעתיד."],
        ["ראית במזלות", "חשבת שקראת בכוכבים את הגורל שנקבע לך."],
        ["להעמיד בן", "להוליד בן."],
        ["ישתנה המזל", "הגורל שנראה קבוע יכול להשתנות."],
      ],
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 4) {
    const box = el(`
      <div class="card">
        <p style="font-weight:700;">גררו (או לחצו על) האות ה׳ אל תוך השם, ושנו את הכתוב בכוכבים.</p>
        <div class="scene revealed">
          <div class="sky"></div>
          <div class="fate-text" id="fateText2">לֹא יִהְיֶה לוֹ בֵּן</div>
          <div class="name-row">
            <div class="name-chip" id="nameChip">אברם</div>
            <div class="he-letter" id="heLetter" draggable="true" title="גררו או לחצו">ה</div>
          </div>
        </div>
        <p class="muted" id="nameHint">אברם ← אברהם</p>
      </div>
    `);
    wrap.appendChild(box);

    const applyChange = () => {
      const chip = box.querySelector("#nameChip");
      const letter = box.querySelector("#heLetter");
      const fate = box.querySelector("#fateText2");
      if (letter.classList.contains("used")) return;
      letter.classList.add("used");
      chip.textContent = "אברהם";
      chip.classList.add("updated");
      fate.textContent = "אַבְרָהָם יֵשׁ לוֹ בֵּן";
      fate.classList.add("changed");
      box.querySelector("#nameHint").textContent = "שרי ← שרה (אותו עיקרון חל גם על שם אשתו)";

      const row = document.createElement("div");
      row.className = "btn-row";
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = "המשך";
      b.addEventListener("click", () => goStep(1));
      row.appendChild(b);
      box.appendChild(row);
    };

    const letterEl = box.querySelector("#heLetter");
    letterEl.addEventListener("click", applyChange);
    letterEl.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", "he"));
    const chipEl = box.querySelector("#nameChip");
    chipEl.addEventListener("dragover", (e) => e.preventDefault());
    chipEl.addEventListener("drop", (e) => {
      e.preventDefault();
      applyChange();
    });
    return;
  }

  if (step === 5) {
    renderMCQ(wrap, {
      question: "מה תפקידו של שינוי השם בפירוש רש״י?",
      options: [
        "שינוי השם מוכיח שלכוכבים אין כל משמעות, ולכן אין צורך להתייחס למה שאברהם ראה בהם.",
        "שינוי השם מסמל כי הקביעה שקרא אברם במזלות אינה חייבת לקבוע את עתידו של אברהם.",
        "שינוי השם נועד להסתיר מן הכוכבים את זהותו האמיתית של אברהם.",
        "שינוי השם מבטל את הבטחת הזרע הקודמת ומחליף אותה בהבטחה חדשה.",
      ],
      correctIndex: 1,
      feedback: 'לפי רש"י, מה שנקרא במזלות מתייחס ל"אברם". כאשר ה׳ משנה את שמו ל"אברהם", משתנה גם המזל. העתיד שנראה כאילו נכתב מראש אינו סופי.',
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 6) {
    renderMCQ(wrap, {
      question: 'מה מבקש ה׳ מאברהם לעשות באמירה "צא מאצטגנינות שלך"?',
      options: [
        "להפסיק להתבונן בכוכבים מפני שאסור ללמוד מהם דבר.",
        "לצאת מן ההנחה שהגורל שקרא בכוכבים קבוע, סגור ואינו יכול להשתנות.",
        "לצאת מן האוהל ולבחון מחדש את מיקומם של הכוכבים.",
        "להחליף את האצטגנינות בשיטה אחרת לחיזוי העתיד.",
      ],
      correctIndex: 1,
      feedback: "ה׳ מבקש מאברהם לצאת מתוך ההנחה שהעתיד שראה בכוכבים סגור וקבוע — ולהאמין שהוא יכול להשתנות.",
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 7) {
    renderClosing(wrap, {
      promptTemplate: "לפי הפירוש השני, ה׳ מוציא את אברהם מן ה____ שנראה כאילו נכתב לו בכוכבים.",
      blanksAccepted: [["הגורל", "גורל", "העתיד", "עתיד", "המזל", "מזל"]],
      insightText: "אברהם יוצא מן המחשבה שהגורל שקרא בכוכבים כבר נכתב ונחתם ואינו יכול להשתנות.",
      stationIndex: 1,
      onComplete: backToMap,
    });
    return;
  }
}

/* ============================= STATION 3 — מעל מערכת הכוכבים ============================= */

function renderStation3(wrap, step) {
  stationHeader(wrap, 2, "החוצה — ממה?");

  if (step === 0) {
    const scene = el(`
      <div class="scene">
        <div class="sky"></div>
        <div class="view-label" id="viewLabel">מבט אל הכוכבים מלמטה</div>
        <div class="horizon-line"></div>
        <div class="rising-marker figure">${FIGURE_SVG}</div>
        <div class="scene-btn-wrap"><button class="btn">עלו מעל הכוכבים</button></div>
        <div class="caption">אתם עומדים על פני הארץ ומביטים אל הכוכבים מלמטה למעלה.</div>
      </div>
    `);
    wrap.appendChild(scene);
    scene.querySelector("button").addEventListener("click", () => {
      scene.classList.add("flipped", "opened");
      scene.querySelector("#viewLabel").textContent = "מבט על הכוכבים מלמעלה";
      scene.querySelector(".caption").textContent = "המצלמה עלתה מעל הכוכבים — כעת הם נראים מתחתיכם.";
      const row = document.createElement("div");
      row.className = "btn-row";
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = "המשך";
      b.addEventListener("click", () => goStep(1));
      row.appendChild(b);
      wrap.appendChild(row);
    });
    return;
  }

  if (step === 1) {
    renderMCQ(wrap, {
      question: "איזו משמעות סמלית עשויה להיות למעבר ממבט מלמטה למבט מלמעלה?",
      options: [
        "אברהם לומד לזהות את מיקומם המדויק של הכוכבים.",
        "אברהם מוצג כמי שאינו כפוף עוד למערכת שהכוכבים מייצגים.",
        "אברהם נעשה חזק מן הכוכבים מבחינה גופנית.",
        "אברהם יכול כעת לספור את הכוכבים ללא קושי.",
      ],
      correctIndex: 1,
      feedback: "המעבר למבט מלמעלה מבטא את היות אברהם מוצב מעל מערכת הכוכבים, ולא כפוף למה שהם מייצגים.",
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 2) {
    renderRashi(wrap, {
      text: "דבר אחר: הוציאו מחללו של עולם והגביהו למעלה מן הכוכבים, וזהו לשון הבטה מלמעלה למטה.",
      glossary: [
        ["דבר אחר", "פירוש נוסף."],
        ["מחללו של עולם", "כביכול אל מחוץ למערכת העולם והכוכבים."],
        ["הגביהו", "העלה אותו למקום גבוה."],
        ["הבטה מלמעלה למטה", "התבוננות בדבר הנמצא מתחת למתבונן."],
      ],
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 3) {
    renderMCQ(wrap, {
      question: 'מדוע רש״י מדגיש שההבטה נעשית "מלמעלה למטה"?',
      options: [
        "כדי להסביר כיצד הצליח אברהם לראות את כל הכוכבים בבת אחת.",
        "כדי לבסס את הרעיון שאברהם הוצב באופן סמלי מעל הכוכבים ואינו כפוף למה שהם מייצגים.",
        "כדי להוכיח שהאירוע התרחש בשעות היום ולא בלילה.",
        "כדי להראות שאברהם שלט בכוכבים והיה יכול לשנות את מקומם.",
      ],
      correctIndex: 1,
      feedback: "הביטוי מדגיש שאברהם הועלה, באופן סמלי, אל מעל למערכת הכוכבים.",
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 4) {
    renderMCQ(wrap, {
      question: "מה מוסיף הפירוש השלישי על הפירוש השני?",
      options: [
        "הפירוש השני עוסק בהבטחת הזרע, ואילו השלישי עוסק רק במספר הכוכבים.",
        "בפירוש השני הגורל שנקרא במזל יכול להשתנות; בפירוש השלישי הבטחת ה׳ אינה כפופה מלכתחילה למערכת המזל והטבע.",
        "בפירוש השני אברהם נמצא מעל הכוכבים, ואילו בשלישי הוא נמצא בתוך האוהל.",
        "הפירוש השלישי מבטל את הפירוש השני וקובע ששינוי השם אינו חשוב.",
      ],
      correctIndex: 1,
      feedback: "בפירוש השני השינוי מתרחש בתוך מערכת המזל: שמו של אברם משתנה וגם מזלו משתנה. בפירוש השלישי ה׳ מעלה את אברהם מעל המערכת כולה — הבטחת ה׳ אינה כפופה לכוכבים, למזל או לחוקי הטבע.",
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 5) {
    renderMCQ(wrap, {
      question: "איזה רעיון מבטא בצורה המדויקת ביותר את ההעלאה מעל הכוכבים?",
      options: [
        "חוקי הטבע אינם קיימים ואינם משפיעים על בני האדם.",
        "אברהם יכול לשלוט בעצמו בחוקי הטבע ובמערכת הכוכבים.",
        "גם כאשר ההבטחה נראית בלתי אפשרית על פי הטבע, כוחו של ה׳ אינו מוגבל על ידי הטבע.",
        "כל אדם המאמין בה׳ יכול לדעת מראש כיצד ישתנו חוקי הטבע עבורו.",
      ],
      correctIndex: 2,
      feedback: "ההעלאה מעל הכוכבים מבטאת שכוחו של ה׳ אינו כפוף לחוקי הטבע — גם כשההבטחה נראית בלתי אפשרית מבחינה טבעית.",
      onNext: () => goStep(1),
    });
    return;
  }

  if (step === 6) {
    renderClosing(wrap, {
      promptTemplate: "לפי הפירוש השלישי, ה׳ מוציא את אברהם אל מעל ה____ ומעל חוקי ה____.",
      blanksAccepted: [
        ["הכוכבים", "כוכבים"],
        ["הטבע", "טבע"],
      ],
      insightText: "הבטחת ה׳ אינה כפופה למערכת הכוכבים, למזל או לחוקי הטבע.",
      stationIndex: 2,
      onComplete: () => setScreen("map"),
    });
    return;
  }
}

/* ============================= SUMMARY SCREEN ============================= */

function renderSummary() {
  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "screen";
  wrap.innerHTML = `
    <div class="eyebrow">משימת סיום</div>
    <h2>שלוש שכבות של יציאה</h2>
    <p class="muted">סדרו את שלושת משפטי התובנה שאספתם, מן הפירוש הפשוט ביותר אל הפירוש המעמיק ביותר.</p>
  `;
  app.appendChild(wrap);

  let order = state.order && state.order.length === 3 ? state.order.slice() : shuffle([0, 1, 2]);

  const listBox = document.createElement("div");
  listBox.className = "card";
  const list = document.createElement("div");
  list.className = "order-list";
  listBox.appendChild(list);
  wrap.appendChild(listBox);

  function draw() {
    list.innerHTML = "";
    order.forEach((originalIdx, pos) => {
      const card = document.createElement("div");
      card.className = "order-card";
      card.draggable = true;
      card.dataset.pos = pos;
      card.innerHTML = `
        <div class="rank">${pos + 1}</div>
        <div class="txt">${LONG_INSIGHTS[originalIdx]}</div>
        <div class="arrows">
          <button data-dir="up" ${pos === 0 ? "disabled" : ""} aria-label="הזיזו למעלה">▲</button>
          <button data-dir="down" ${pos === order.length - 1 ? "disabled" : ""} aria-label="הזיזו למטה">▼</button>
        </div>
      `;
      card.querySelectorAll(".arrows button").forEach((btn) => {
        btn.addEventListener("click", () => {
          const dir = btn.dataset.dir;
          const p = Number(card.dataset.pos);
          const swapWith = dir === "up" ? p - 1 : p + 1;
          if (swapWith < 0 || swapWith >= order.length) return;
          [order[p], order[swapWith]] = [order[swapWith], order[p]];
          draw();
        });
      });
      card.addEventListener("dragstart", () => card.classList.add("dragging"));
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("dragover", (e) => e.preventDefault());
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        const draggedEl = list.querySelector(".dragging");
        if (!draggedEl || draggedEl === card) return;
        const from = Number(draggedEl.dataset.pos);
        const to = Number(card.dataset.pos);
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);
        draw();
      });
      list.appendChild(card);
    });
    state.order = order.slice();
    saveState();
  }
  draw();

  const checkRow = document.createElement("div");
  checkRow.className = "btn-row";
  const checkBtn = document.createElement("button");
  checkBtn.className = "btn";
  checkBtn.textContent = "בדקו סדר";
  checkRow.appendChild(checkBtn);
  wrap.appendChild(checkRow);

  checkBtn.addEventListener("click", () => {
    const correct = order[0] === 0 && order[1] === 1 && order[2] === 2;
    let fb = wrap.querySelector(".order-feedback");
    if (!fb) {
      fb = document.createElement("div");
      fb.className = "feedback order-feedback";
      wrap.insertBefore(fb, checkRow);
    }
    if (correct) {
      fb.className = "feedback good order-feedback";
      fb.textContent = "מדויק! מן היציאה הפיזית מן האוהל, דרך היציאה מן הגורל שבכוכבים, ועד ליציאה אל מעל מערכת הכוכבים והטבע כולה.";
      if (!wrap.querySelector("#toFinalQBtn")) {
        const b = document.createElement("button");
        b.id = "toFinalQBtn";
        b.className = "btn";
        b.style.marginTop = "12px";
        b.textContent = "לשאלת הסיכום";
        b.addEventListener("click", () => renderFinalQuestion(wrap, b));
        wrap.appendChild(b);
      }
    } else {
      fb.className = "feedback bad order-feedback";
      fb.textContent = "עדיין לא. חשבו: איזו יציאה היא הכי מוחשית וקרובה (מקום פיזי), ואיזו היא הכי מופשטת ורחבה (מעל הטבע כולו)?";
    }
  });

  app.appendChild(wrap);
}

function renderFinalQuestion(wrap, afterBtn) {
  afterBtn.remove();
  const holder = document.createElement("div");
  wrap.appendChild(holder);
  renderMCQ(holder, {
    question: FINAL_SUMMARY_QUESTION.question,
    options: FINAL_SUMMARY_QUESTION.options,
    correctIndex: FINAL_SUMMARY_QUESTION.correctIndex,
    feedback: FINAL_SUMMARY_QUESTION.feedback,
    nextLabel: "סיימו",
    onNext: () => renderFinalScreen(wrap),
  });
}

function renderFinalScreen(wrap) {
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `
    <div class="eyebrow">משפט מסכם</div>
    <div class="final-quote">${FINAL_QUOTE}</div>
  `;
  const row = document.createElement("div");
  row.className = "btn-row";
  row.style.justifyContent = "center";
  const restart = document.createElement("button");
  restart.className = "btn ghost";
  restart.textContent = "עברו על התחנות שוב";
  restart.addEventListener("click", () => setScreen("map"));
  row.appendChild(restart);
  box.appendChild(row);
  wrap.appendChild(box);
  wrap.scrollIntoView({ behavior: "smooth", block: "end" });
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================= INIT ============================= */

buildStarfield();
render();
