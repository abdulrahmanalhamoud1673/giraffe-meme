/* عمرك فكرت؟ — shared behaviour: story list, next card, random, share, catchphrase */
/* ?og renders just the headline, used to screenshot the WhatsApp preview images in og/ */
if (new URLSearchParams(location.search).has("og")) document.documentElement.classList.add("og");

const STORIES = [
  { id: "giraffe",  emoji: "🦒", name: "الزرافة",  color: "#F5B83D", q: "لو الزرافة طلبت هوت شوكلت... هيوصل بطنها بارد؟" },
  { id: "sloth",    emoji: "🦥", name: "الكسلان",  color: "#A3D65C", q: "لو الكسلان عنده واتساب... هيرد عليك إمتى؟" },
  { id: "octopus",  emoji: "🐙", name: "الأخطبوط", color: "#C77DFF", q: "الأخطبوط عنده ٣ قلوب... يعني لما حد يسيبه قلبه بيتكسر ٣ مرات؟" },
  { id: "flamingo", emoji: "🦩", name: "البشروش",  color: "#FF8FB1", q: "البشروش بمبي عشان بياكل جمبري... طب لو أكل كشري؟" },
  { id: "hedgehog", emoji: "🦔", name: "القنفذ",   color: "#FF6B6B", q: "القنفذ عمره ما عرف يمسك بالونة في عيد ميلاده؟" },
  { id: "turtle",   emoji: "🐢", name: "السلحفاة", color: "#3DDC97", q: "لو السلحفاة طلبت ديليفري... هتلحق تفتح الباب قبل الطيار ما يمشي؟" },
  { id: "owl",      emoji: "🦉", name: "البومة",   color: "#FFB347", q: "البومة بتلف راسها ٢٧٠ درجة... طب لو لفّت أكتر؟" },
  { id: "shark",    emoji: "🦈", name: "القرش",    color: "#6FD3FF", q: "في قروش لو وقفت عوم بتتخنق... يعني عمرها ما خدت إجازة؟" },
];

const ar = (n, d = 0) => Number(n).toLocaleString("ar-EG", { minimumFractionDigits: d, maximumFractionDigits: d });
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const storyUrl = (s) => `${s.id}.html`;

/* which animals this visitor already "thought about" (this browser only) */
const Visited = {
  key: "amrak-fakkart-visited",
  get() {
    try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; }
  },
  add(id) {
    const list = this.get();
    if (list.includes(id)) return;
    list.push(id);
    try { localStorage.setItem(this.key, JSON.stringify(list)); } catch { /* private mode */ }
  },
};

function goRandom(exceptId) {
  const pool = STORIES.filter((s) => s.id !== exceptId);
  const seen = Visited.get();
  const fresh = pool.filter((s) => !seen.includes(s.id));
  const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
  location.href = storyUrl(pick);
}

function shareOnWhatsApp(text) {
  const url = location.href.split("#")[0];
  window.open("https://wa.me/?text=" + encodeURIComponent(`${text}\n${url}`), "_blank", "noopener");
}

/* ---------- the catchphrase from the original video ---------- */
function mountPunch(el) {
  el.innerHTML = `
    <p class="silence">( ٤ ثواني صمت درامي... )</p>
    <p class="meme-text caption-line big">
      <span class="w">لا</span> <span class="w">أكيد</span> <span class="w">عمرك</span> <span class="w">ما</span> <span class="w">فكرت.</span>
    </p>
    <p class="meme-text caption-line small">
      <span class="w">عشان</span> <span class="w">الإنسان</span> <span class="w">ما</span> <span class="w">بيفكرش</span> <span class="w">غير</span> <span class="w">في</span> <span class="w">نفسه</span> <span class="w">💔</span>
    </p>
    <button class="btn" type="button">▶ شغّل الرد زي الفيديو</button>`;

  const silence = el.querySelector(".silence");
  const btn = el.querySelector("button");
  const [line1, line2] = [...el.querySelectorAll(".caption-line")].map((l) => [...l.querySelectorAll(".w")]);
  const all = [...line1, ...line2];
  const SILENCE_TEXT = silence.textContent;
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  btn.addEventListener("click", () => {
    timers.forEach(clearTimeout);
    timers = [];
    all.forEach((w) => w.classList.remove("on", "said"));
    el.classList.add("playing");
    btn.disabled = true;

    let at = 0;
    [4, 3, 2, 1].forEach((n) => { later(at, () => { silence.textContent = `( صمت درامي... ${ar(n)} )`; }); at += 900; });
    later(at, () => { silence.textContent = SILENCE_TEXT; });
    const say = (words, gap) => words.forEach((w) => {
      later(at, () => { all.forEach((x) => x.classList.remove("on")); w.classList.add("on", "said"); });
      at += gap;
    });
    say(line1, 430);
    at += 450;
    say(line2, 380);
    later(at + 500, () => {
      all.forEach((x) => x.classList.remove("on"));
      el.classList.remove("playing");
      btn.disabled = false;
      btn.textContent = "🔁 تاني";
    });
  });
}

/* ---------- wiring for a story page ---------- */
function mountStoryPage() {
  const id = document.body.dataset.story;
  const i = STORIES.findIndex((s) => s.id === id);
  if (i < 0) return;
  const story = STORIES[i];
  Visited.add(id);

  document.getElementById("randomBtn")?.addEventListener("click", () => goRandom(id));
  document.getElementById("shareBtn")?.addEventListener("click", () => shareOnWhatsApp(`عمرك فكرت؟ ${story.q} ${story.emoji}`));

  const punch = document.getElementById("punch");
  if (punch) mountPunch(punch);

  const next = document.getElementById("next");
  if (next) {
    const n = STORIES[(i + 1) % STORIES.length];
    next.innerHTML = `
      <a class="next-card" href="${storyUrl(n)}" style="--accent:${n.color}">
        <span class="next-emoji" aria-hidden="true">${n.emoji}</span>
        <span><small>السؤال اللي بعده • ${n.name}</small><b>${n.q}</b></span>
        <span class="next-arrow" aria-hidden="true">←</span>
      </a>`;
  }
}

document.addEventListener("DOMContentLoaded", mountStoryPage);
