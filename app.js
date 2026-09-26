"use strict";
/* Конторское ДЗ — клиент. Данные: Supabase (homework, done, хранилище scans). */

const cfg = window.KDZ_CONFIG;
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

const MON = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const MONN = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const WD = ["вс","пн","вт","ср","чт","пт","сб"];
const TZ = "Europe/Moscow";
const $ = (id) => document.getElementById(id);

function todayIso() {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  catch (e) { return new Date().toISOString().slice(0, 10); }
}
let today = todayIso();
const iso = (d) => d.toISOString().slice(0, 10);
const gap = (due) => Math.round((new Date(due + "T00:00:00Z") - new Date(today + "T00:00:00Z")) / 86400000);
function human(dt) { const d = new Date(dt + "T00:00:00Z"); return WD[d.getUTCDay()] + ", " + d.getUTCDate() + " " + MON[d.getUTCMonth()]; }
function el(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
function lsGet(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

/* ---------- Тема ---------- */
function applyThemeIcon() {
  const t = document.documentElement.dataset.theme;
  const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  $("themeBtn").textContent = dark ? "☀︎" : "☾";
}
$("themeBtn").addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("kdz-theme", next); } catch (e) {}
  applyThemeIcon();
});
applyThemeIcon();

/* ---------- Состояние ---------- */
let hw = lsGet("kdz-hw", []);
let books = lsGet("kdz-books", []);
let mats = lsGet("kdz-mat", []);
let vocab = lsGet("kdz-vocab", []);
let res = lsGet("kdz-res", []);
let mine = new Set(lsGet("kdz-done", []));
let sel = null;
let view = new Date(today + "T00:00:00Z"); view.setUTCDate(1);
let user = null;

// Постоянные цвета предметов (совпадают с расписанием).
const COURSE_COLORS = {
  "ПОСИ-2": "posi", "ММСИ": "mmsi", "Испанский": "es",
  "Английский": "en", "Анализ данных в социологии": "ads", "Социология маркетинга": "mkt", "Политическая социология": "pol",
};
/** Цвет заливки предмета (календарь, полоски, галочки). */
function courseColor(c) {
  if (COURSE_COLORS[c]) return "var(--k-" + COURSE_COLORS[c] + ")";
  let h = 0; for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return "var(--c" + (1 + (h % 7)) + ")";
}
/** Цвет текста предмета — темнее заливки, чтобы жёлтый и голубой читались на белом. */
function courseText(c) { return COURSE_COLORS[c] ? "var(--k-" + COURSE_COLORS[c] + "-t)" : courseColor(c); }
function badge(due) {
  if (!due) return ["без срока", "bn"];
  const g = gap(due);
  if (g < 0) return ["срок прошёл", "bn"];
  if (g === 0) return ["сдать сегодня", "b0"];
  if (g === 1) return ["сдать завтра", "b1"];
  return ["сдать через " + g + " " + plural(g, "день", "дня", "дней"), "b" + Math.min(g, 5)];
}

/* ---------- Календарь ---------- */
const LEGEND_SHORT = { "Анализ данных в социологии": "Анализ данных", "Социология маркетинга": "Соц. маркетинга" };
function renderCal() {
  const g = $("grid"); g.innerHTML = "";
  $("monthT").textContent = MONN[view.getUTCMonth()] + " " + view.getUTCFullYear();
  ["пн","вт","ср","чт","пт","сб","вс"].forEach((w) => g.appendChild(el("div", "wd", w)));
  const shift = (view.getUTCDay() + 6) % 7;
  const start = new Date(view); start.setUTCDate(1 - shift);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); const ds = iso(d);
    if (i >= 35 && d.getUTCMonth() !== view.getUTCMonth()) break;
    const items = hw.filter((x) => x.due === ds);
    // Один цвет на предмет: весь квадратик закрашен, при нескольких предметах — поделён на полосы.
    const courses = [...new Set(items.map((x) => x.course))].sort((a, c) => a.localeCompare(c, "ru"));
    const allDone = items.length && items.every((x) => mine.has(x.id));
    const b = el("button", "day" + (d.getUTCMonth() !== view.getUTCMonth() ? " out" : "") + (ds === today ? " today" : "") + (ds === sel ? " sel" : "") + (courses.length ? " due" : "") + (allDone ? " done" : ""));
    b.type = "button";
    b.setAttribute("aria-label", human(ds) + (items.length ? ": сдать " + items.length + " (" + courses.join(", ") + ")" + (allDone ? ", всё сделано" : "") : ""));
    if (courses.length) {
      const step = 100 / courses.length;
      b.style.background = "linear-gradient(90deg," + courses.map((c, k) => courseColor(c) + " " + (k * step).toFixed(2) + "% " + ((k + 1) * step).toFixed(2) + "%").join(",") + ")";
      b.title = courses.join(", ");
    }
    b.appendChild(el("span", "n", String(d.getUTCDate())));
    b.addEventListener("click", () => { sel = sel === ds ? null : ds; schedDate = null; render(); });
    g.appendChild(b);
  }
  const lg = $("legend"); lg.innerHTML = "";
  [...new Set(hw.map((x) => x.course))].sort().forEach((c) => {
    const s = el("span"); const d = el("span", "dot"); d.style.setProperty("--cc", courseColor(c));
    s.append(d, LEGEND_SHORT[c] || c); s.title = c; lg.appendChild(s);
  });
}

/* ---------- Задания ---------- */
function dueLine(x) {
  const [t, cls] = badge(x.due);
  const w = el("span", "dueline");
  if (x.due) w.appendChild(el("span", "dd", "сдать " + human(x.due)));
  w.appendChild(el("span", "badge " + cls, t));
  return w;
}

/* ---------- Страницы учебников ---------- */
// «стр. 14–15», «p. 129», «pp. 120-121», «pág. 49», «стр. 45, 47 и 49–51»
const PAGE_RE = /(?<![A-Za-zА-Яа-яЁёÀ-ÿ])(?:(?:стр|p|pp|pg|pág|págs|pag|page|pages|página|páginas)\.?|с\.)\s*(\d{1,3}(?:\s*[–—-]\s*\d{1,3})?(?:\s*(?:,|и|and|y)\s*\d{1,3}(?:\s*[–—-]\s*\d{1,3})?)*)(?!\d)/gi;
function pageNums(text) {
  const out = [];
  for (const m of text.matchAll(PAGE_RE)) {
    for (const part of m[1].split(/\s*(?:,|и|and|y)\s*/)) {
      const [a, b] = part.split(/\s*[–—-]\s*/).map(Number);
      const hi = b && b >= a && b - a <= 30 ? b : a;
      for (let n = a; n <= hi; n++) if (!out.includes(n)) out.push(n);
    }
  }
  return out;
}
function findBook(text, course) {
  const t = text.toLowerCase();
  const cand = books.filter((b) => (b.aliases || []).some((a) => t.includes(a)));
  return cand.find((b) => b.course === course) || cand[0] || null;
}
/** Страницы для задания: из учебника целиком (если распознаны), иначе — прикреплённые сканы. */
function taskPages(x) {
  const book = findBook(x.title, x.course) || findBook(x.title + " " + (x.summary || ""), x.course);
  if (book && book.pages) {
    const nums = pageNums(x.title + " " + (x.summary || "")).filter((n) => book.pages[String(n)]).slice(0, 20);
    if (nums.length) return nums.map((n) => ({ label: book.title + ", стр. " + n, path: book.pages[String(n)] }));
  }
  return x.pages || [];
}

const urlCache = new Map();
async function signedUrls(paths) {
  const need = paths.filter((p) => { const c = urlCache.get(p); return !c || c.exp < Date.now(); });
  if (need.length) {
    const { data, error } = await sb.storage.from("scans").createSignedUrls(need, 3600);
    if (error || !data) throw error || new Error("no data");
    data.forEach((d, i) => { if (d.signedUrl) urlCache.set(need[i], { url: d.signedUrl, exp: Date.now() + 50 * 60 * 1000 }); });
  }
  return paths.map((p) => (urlCache.get(p) || {}).url || "");
}

async function loadScans(det, pages) {
  let urls;
  try { urls = await signedUrls(pages.map((p) => p.path)); }
  catch (e) { det.appendChild(el("p", "sum", "Не удалось загрузить страницы. Проверь интернет и открой ещё раз.")); det.dataset.loaded = ""; return; }
  pages.forEach((p, i) => {
    const f = el("figure"); const im = el("img");
    im.src = urls[i]; im.alt = p.label; im.loading = "lazy"; im.decoding = "async";
    f.append(im, el("figcaption", null, p.label)); det.appendChild(f);
  });
}

/* ---------- Материалы из Telegram ---------- */
const DAY = 86400000;
/** Материалы к заданию: по номеру («дорожка 47», «pista 12») или по времени — за 2 недели до срока. */
function taskMaterials(x) {
  if (!x.telegram) return [];
  const own = mats.filter((m) => m.course === x.course);
  if (!own.length) return [];
  // Задание пришло из Telegram-группы: вложения того же сообщения + всё, что прислали в группу
  // за 3 часа до и после него (обычно аудио и файлы идут рядом с текстом задания).
  const tg = /^tg-(m?\d+)-(\d+)$/.exec(x.id);
  if (tg) {
    const chatId = Number(tg[1].replace("m", "-")), msgId = Number(tg[2]);
    const at = Date.parse(x.created_at || "") || 0;
    const near = own.filter((m) => m.chat_id === chatId && (m.message_id === msgId || (at && Math.abs(Date.parse(m.posted_at) - at) <= 3 * 3600 * 1000)));
    if (near.length) return near.sort((a, c) => Date.parse(a.posted_at) - Date.parse(c.posted_at)).slice(0, 10);
  }
  const strong = [...x.telegram.matchAll(/(?:дорожк\S*|трек\S*|track|pista|аудио|audio|№)\s*(\d{1,3})/gi)].map((m) => m[1]);
  if (strong.length) {
    const hit = own.filter((m) => strong.some((n) => new RegExp("(^|[^\\d])" + n + "([^\\d]|$)").test((m.file_name || "") + " " + (m.caption || ""))));
    if (hit.length) return hit.slice(0, 6);
  }
  const end = x.due ? Date.parse(x.due + "T23:59:59+03:00") : Date.now();
  return own.filter((m) => { const t = Date.parse(m.posted_at); return t <= end && t >= end - 14 * DAY; }).slice(0, 6);
}
function linkify(text) {
  const f = document.createDocumentFragment();
  text.split(/(https?:\/\/[^\s]+)/g).forEach((part, i) => {
    if (i % 2) { const a = el("a", null, part); a.href = part; a.target = "_blank"; a.rel = "noopener"; f.appendChild(a); }
    else if (part) f.appendChild(document.createTextNode(part));
  });
  return f;
}
const matDate = (m) => { const d = new Date(m.posted_at); return d.getDate() + " " + MON[d.getMonth()]; };
async function renderMats(box, list, showCourse, slides) {
  let urls = [];
  try { urls = await signedUrls(list.filter((m) => m.path).map((m) => m.path)); } catch (e) {}
  const byPath = new Map(list.filter((m) => m.path).map((m, i) => [m.path, urls[i]]));
  list.forEach((m, i) => {
    const it = el("div", "mat");
    const head = slides ? "Слайд " + (i + 1) : (showCourse ? m.course + " · " : "") + matDate(m) + (m.file_name && m.kind !== "photo" ? " · " + m.file_name : "");
    it.appendChild(el("div", "mat-h", head));
    const u = m.path ? byPath.get(m.path) : "";
    if (u && (m.kind === "audio" || m.kind === "voice")) { const au = el("audio"); au.controls = true; au.preload = "none"; au.src = u; it.appendChild(au); }
    else if (u && m.kind === "photo") { const im = el("img"); im.src = u; im.loading = "lazy"; im.alt = m.caption || "Фото из Telegram"; it.appendChild(im); }
    else if (u) { const a = el("a", null, "Открыть файл →"); a.href = u; a.target = "_blank"; a.rel = "noopener"; it.appendChild(a); }
    if (m.caption) { const c = el("p", "sum"); c.appendChild(linkify(m.caption)); it.appendChild(c); }
    if (m.text) { const d = el("details", "ocr"); d.appendChild(el("summary", null, "Текст со слайда")); d.appendChild(el("p", "sum", m.text)); it.appendChild(d); }
    if (!u && m.kind !== "link" && m.tg_link) { const a = el("a", null, "Файл большой — открыть в Telegram →"); a.href = m.tg_link; a.target = "_blank"; a.rel = "noopener"; it.appendChild(a); }
    box.appendChild(it);
  });
}
function matsDetails(list, title, showCourse) {
  const det = el("details", "pages");
  det.appendChild(el("summary", null, title + " (" + list.length + ")"));
  det.addEventListener("toggle", () => { if (det.open && !det.dataset.loaded) { det.dataset.loaded = "1"; renderMats(det, list, showCourse); } });
  return det;
}
/** Лекции (фото одной пары) — одним блоком с общим текстом; остальное — по одному. */
function matGroups(list) {
  const groups = [], byKey = new Map();
  list.forEach((m) => {
    if (m.lecture) {
      let g = byKey.get(m.course + "|" + m.lecture);
      if (!g) { g = { lecture: m.lecture, course: m.course, items: [] }; byKey.set(m.course + "|" + m.lecture, g); groups.push(g); }
      g.items.push(m);
    } else groups.push({ items: [m] });
  });
  return groups;
}
function lectureTitle(g) {
  const [d, t] = g.lecture.split(" "); const x = new Date(d + "T00:00:00Z");
  return g.course + " · " + WD[x.getUTCDay()] + ", " + x.getUTCDate() + " " + MON[x.getUTCMonth()] + (/^\d\d:\d\d$/.test(t || "") ? ", " + t : "");
}
function showMats(list) {
  const out = $("matsOut"); out.innerHTML = "";
  if (!list.length) { out.appendChild(el("p", "sum", "Ничего не найдено.")); return; }
  const loose = [];
  const flush = () => { if (loose.length) { const box = el("div"); out.appendChild(box); renderMats(box, loose.splice(0), true); } };
  matGroups(list).slice(0, 40).forEach((g) => {
    if (!g.lecture) { loose.push(g.items[0]); return; }
    flush();
    const items = g.items.slice().sort((a, c) => Date.parse(a.posted_at) - Date.parse(c.posted_at));
    const sec = el("details", "lecture");
    sec.appendChild(el("summary", null, lectureTitle(g) + " — " + items.length + " фото"));
    const all = items.map((m) => m.text).filter(Boolean).join("\n\n— — —\n\n");
    if (all) { const d = el("details", "ocr"); d.appendChild(el("summary", null, "Весь текст лекции")); d.appendChild(el("p", "sum", all)); sec.appendChild(d); }
    sec.addEventListener("toggle", () => { if (sec.open && !sec.dataset.loaded) { sec.dataset.loaded = "1"; renderMats(sec, items, false); } });
    out.appendChild(sec);
  });
  flush();
}
function filterMats() {
  const q = $("matsQ").value.trim().toLowerCase();
  if (!q) { showMats(mats); return; }
  showMats(mats.filter((m) => [m.text, m.caption, m.file_name, m.course].some((v) => (v || "").toLowerCase().includes(q))));
}
function renderMatsBox() {} // раздел «Из Telegram» убран; материалы видны в заданиях и в «Для Примакова»

/* ---------- Конфетти при отметке «сделано» ---------- */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function celebrate(fromEl, course) {
  if (!window.confetti || calm()) return;
  const r = fromEl.getBoundingClientRect();
  const origin = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
  const css = getComputedStyle(document.documentElement);
  const cc = COURSE_COLORS[course] ? css.getPropertyValue("--k-" + COURSE_COLORS[course]).trim() : "";
  const colors = [cc || "#5B3FA8", "#FFD43B", "#FF6B6B", "#6EA8FE", "#5ED3A9", "#B197FC"];
  confetti({ particleCount: 70, spread: 75, startVelocity: 32, origin, colors, scalar: 0.9, ticks: 160, zIndex: 9999 });
  // Все текущие задания сделаны — большой салют с двух сторон.
  const cur = hw.filter((x) => !x.due || gap(x.due) >= 0);
  if (cur.length && cur.every((x) => mine.has(x.id))) {
    const end = Date.now() + 1200;
    (function frame() {
      confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, zIndex: 9999 });
      confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, zIndex: 9999 });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }
}

async function toggleDone(id, on, li, cb, onToggle) {
  if (on) mine.add(id); else mine.delete(id);
  lsSet("kdz-done", [...mine]); li.classList.toggle("done", on); onToggle();
  if (on) { const t = hw.find((x) => x.id === id); celebrate(cb.parentElement, t ? t.course : ""); }
  const res = on
    ? await sb.from("done").upsert({ user_id: user.id, homework_id: id }, { onConflict: "user_id,homework_id", ignoreDuplicates: true })
    : await sb.from("done").delete().eq("homework_id", id).eq("user_id", user.id);
  if (res.error) {
    if (on) mine.delete(id); else mine.add(id);
    lsSet("kdz-done", [...mine]); cb.checked = !on; li.classList.toggle("done", !on); onToggle();
    setStatus("Не удалось сохранить отметку — нет связи. Попробуй ещё раз.");
  }
}

function taskRow(x, onToggle) {
  const li = el("li", "task" + (mine.has(x.id) ? " done" : ""));
  const cell = el("label", "cell"); const cb = el("input"); cb.type = "checkbox"; cb.id = "hw-" + x.id; cb.checked = mine.has(x.id);
  cb.setAttribute("aria-label", "Сделано: " + x.title);
  const box = el("span", "box"); cell.append(cb, box);
  cb.addEventListener("change", () => toggleDone(x.id, cb.checked, li, cb, onToggle));
  const b = el("div", "body");
  const t = el("label", "ttl", x.title); t.htmlFor = cb.id; b.append(t);
  if (x.summary) b.appendChild(el("p", "sum", x.summary));
  const pages = taskPages(x);
  if (pages.length) {
    const det = el("details", "pages");
    det.appendChild(el("summary", null, "Страницы учебника (" + pages.length + ")"));
    det.addEventListener("toggle", () => { if (det.open && !det.dataset.loaded) { det.dataset.loaded = "1"; loadScans(det, pages); } });
    b.appendChild(det);
  }
  if (x.telegram) {
    b.appendChild(el("span", "tg", "Из Telegram: " + x.telegram));
    const tm = taskMaterials(x);
    if (tm.length) b.appendChild(matsDetails(tm, /^tg-/.test(x.id) ? "Материалы к заданию" : "Материалы из Telegram", false));
  }
  if (x.link) { const a = el("a", null, /t\.me\//.test(x.link) ? "Открыть сообщение в Telegram →" : "Открыть в Google Классе →"); a.href = x.link; a.target = "_blank"; a.rel = "noopener"; b.appendChild(a); }
  li.append(cell, b);
  return li;
}

function subjectBlocks(items, box) {
  // Порядок — по близости срока; подряд идущие задания одного предмета объединяются в одну карточку.
  // Если у предмета несколько сроков, а между ними есть другие предметы, — это отдельные карточки на своих местах.
  const key = (x) => x.due || "9999-99-99";
  const sorted = items.slice().sort((a, b) => key(a).localeCompare(key(b)) || a.course.localeCompare(b.course, "ru") || a.title.localeCompare(b.title, "ru"));
  const blocks = [];
  sorted.forEach((x) => { const last = blocks[blocks.length - 1]; if (last && last.course === x.course) last.list.push(x); else blocks.push({ course: x.course, list: [x] }); });
  blocks.forEach(({ course, list }) => {
    const sec = el("section", "subj"); sec.style.setProperty("--cc", courseColor(course)); sec.style.setProperty("--cct", courseText(course));
    const head = el("header", "subj-h"); const cnt = el("span", "cnt");
    const upd = () => { const d = list.filter((x) => mine.has(x.id)).length; cnt.textContent = "сделано " + d + " из " + list.length; sec.classList.toggle("all", d === list.length); renderCal(); };
    head.append(el("h2", null, course), cnt); sec.appendChild(head);
    const dates = [...new Set(list.map((x) => x.due || ""))];
    if (dates.length === 1) {
      head.appendChild(dueLine(list[0]));
      const ul = el("ul", "rows"); list.forEach((x) => ul.appendChild(taskRow(x, upd))); sec.appendChild(ul);
    } else dates.forEach((d) => {
      const g = el("div", "dgroup"); const its = list.filter((x) => (x.due || "") === d);
      g.appendChild(dueLine(its[0]));
      const ul = el("ul", "rows"); its.forEach((x) => ul.appendChild(taskRow(x, upd))); g.appendChild(ul); sec.appendChild(g);
    });
    const d0 = list.filter((x) => mine.has(x.id)).length; cnt.textContent = "сделано " + d0 + " из " + list.length; sec.classList.toggle("all", d0 === list.length);
    box.appendChild(sec);
  });
}

/* ---------- Пары (одинаковые каждую неделю) ---------- */
const SCHED = {
  1: [{ s: "08:00", e: "09:20", n: "Социология маркетинга", t: "Лекция", r: "ауд. 707, Комсомольский пр-т, д. 6", p: "Салихова И.С.", hw: "Социология маркетинга" },
      { s: "09:30", e: "10:50", n: "Методология и методы социологического исследования (ММСИ)", t: "Лекция", r: "ауд. 63, Остоженка, д. 38 с1", p: "Станевич А.Ю.", hw: "ММСИ" },
      { s: "11:00", e: "12:20", n: "Проектирование и организация социологического исследования (ПОСИ)", t: "Лекция", r: "ауд. 57, Остоженка, д. 38 с1", p: "Примаков В.Л.", hw: "ПОСИ-2" }],
  2: [{ s: "08:00", e: "12:20", n: "Английский (первый иностранный язык)", t: "Практика", r: "ИМО-2, дистанционно", p: "Валиулина Т.А.", hw: "Английский" }],
  3: [{ s: "08:00", e: "09:20", n: "Математическая статистика в социологии", t: "Практика", r: "ауд. 207, Комсомольский пр-т, д. 6", p: "Примаков В.Л." },
      { s: "09:30", e: "10:50", n: "Проектирование и организация социологического исследования (ПОСИ)", t: "Практика", r: "ауд. 207, Комсомольский пр-т, д. 6", p: "Примаков В.Л.", hw: "ПОСИ-2" },
      { s: "11:00", e: "12:20", n: "Анализ данных в социологии", t: "Семинар", r: "ауд. 64, Остоженка, д. 38 с1", p: "Исаев Е.Н.", hw: "Анализ данных в социологии" },
      { s: "13:00", e: "14:20", n: "Общая физическая подготовка", t: "Практика", r: "Большой спортзал, зона 1, Остоженка, д. 38 с2", p: "Кашкова М.П." }],
  4: [],
  5: [{ s: "09:30", e: "10:50", n: "Испанский (второй иностранный язык)", t: "Практика", r: "ауд. 322, Остоженка, д. 38 с2", p: "Васецкая Ю.А.", hw: "Испанский" },
      { s: "11:00", e: "12:20", n: "Политическая социология", t: "Практика", r: "ауд. 205-4, Остоженка, д. 38 с2", p: "Саблуков А.В." }],
  6: [{ s: "08:00", e: "10:50", n: "Испанский (второй иностранный язык)", t: "Практика", r: "ауд. 202, учебный корпус", p: "Харитонова М.А.", hw: "Испанский" }],
};
const WDF = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const wdOf = (ds) => new Date(ds + "T00:00:00Z").getUTCDay();
function addD(ds, k) { const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return iso(d); }
const mondayOf = (ds) => addD(ds, -((wdOf(ds) + 6) % 7));
let schedDate = null;

function renderSched() {
  if (!schedDate) { schedDate = sel || today; if (wdOf(schedDate) === 0) schedDate = addD(schedDate, 1); }
  const mon = mondayOf(schedDate), wd = wdOf(schedDate), sat = addD(mon, 5);
  const dm = (d) => { const x = new Date(d + "T00:00:00Z"); return x.getUTCDate() + " " + MON[x.getUTCMonth()]; };
  const a = new Date(mon + "T00:00:00Z"), z = new Date(sat + "T00:00:00Z");
  const rng = a.getUTCMonth() === z.getUTCMonth() ? a.getUTCDate() + "–" + dm(sat) : dm(mon) + " – " + dm(sat);
  $("wkT").textContent = rng + (mon === mondayOf(today) ? " · сейчас" : "");
  const tabs = $("tabs"); tabs.innerHTML = "";
  for (let d = 1; d <= 6; d++) {
    const ds = addD(mon, d - 1);
    const b = el("button", "tab" + (d === wd ? " on" : "") + ((SCHED[d] || []).length ? "" : " empty") + (ds === today ? " today" : ""));
    b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", d === wd ? "true" : "false"); b.setAttribute("aria-label", human(ds));
    b.append(el("span", "tw", WDF[d]), el("span", "tn", String(new Date(ds + "T00:00:00Z").getUTCDate())));
    if (hw.some((x) => x.due === ds)) b.appendChild(el("span", "tdot"));
    b.addEventListener("click", () => { schedDate = ds; renderSched(); });
    tabs.appendChild(b);
  }
  const ol = $("pairs"); ol.innerHTML = "";
  const list = SCHED[wd] || [];
  if (!list.length) ol.appendChild(el("li", "nopair", "Пар нет"));
  list.forEach((p) => {
    const li = el("li", "pair"); li.style.setProperty("--cc", p.hw ? courseColor(p.hw) : "var(--line)"); li.style.setProperty("--cct", p.hw ? courseText(p.hw) : "var(--muted)");
    const tm = el("div", "ptime"); tm.append(el("b", null, p.s), el("span", null, p.e));
    const b = el("div", "pbody"); b.append(el("span", "pname", p.n), el("span", "pmeta", p.t + " · " + p.r), el("span", "pmeta", p.p));
    const due = p.hw ? hw.filter((x) => x.course === p.hw && x.due === schedDate) : [];
    if (due.length) b.appendChild(el("span", "phw", "Сдать в этот день: " + due.length));
    li.append(tm, b); ol.appendChild(li);
  });
  const dueDay = hw.filter((x) => x.due === schedDate);
  if (dueDay.length) ol.appendChild(el("li", "pdue", "Срок сдачи в этот день: " + [...new Set(dueDay.map((x) => x.course))].join(", ")));
}
$("prevW").addEventListener("click", () => { schedDate = addD(schedDate, -7); renderSched(); });
$("nextW").addEventListener("click", () => { schedDate = addD(schedDate, 7); renderSched(); });

/* ---------- Отрисовка ---------- */
function render() {
  renderCal(); renderSched(); renderBooks(); renderMatsBox(); renderCounts(); renderDaily();
  const list = $("list"); list.innerHTML = "";
  if (sel) {
    $("filter").hidden = false; $("filterT").textContent = "Срок: " + human(sel);
    const its = hw.filter((x) => x.due === sel);
    if (its.length) subjectBlocks(its, list); else list.appendChild(el("p", "empty", "На этот день сдавать нечего."));
  } else {
    $("filter").hidden = true;
    const cur = hw.filter((x) => !x.due || gap(x.due) >= 0);
    if (cur.length) subjectBlocks(cur, list); else list.appendChild(el("p", "empty", hw.length ? "Ближайших сроков нет." : "Заданий пока нет."));
  }
  const pastI = hw.filter((x) => x.due && gap(x.due) < 0); const pb = $("pastBox");
  pb.hidden = !pastI.length || !!sel;
  if (pastI.length) { $("pastT").textContent = "Прошедшие сроки (" + pastI.length + ")"; const p = $("past"); p.innerHTML = ""; subjectBlocks(pastI, p); }
}
$("prevM").addEventListener("click", () => { view.setUTCMonth(view.getUTCMonth() - 1); renderCal(); });
$("nextM").addEventListener("click", () => { view.setUTCMonth(view.getUTCMonth() + 1); renderCal(); });
$("clearF").addEventListener("click", () => { sel = null; schedDate = null; render(); });

/* ---------- Учебники: ссылки на целые PDF ---------- */
const bookPdfs = (b) => (b.pages && b.pages.pdf && b.pages.pdf.files) || [];
function renderBooks() {
  $("booksCnt").textContent = books.filter((b) => bookPdfs(b).length).length || "";
  if (!$("booksBox").hidden) renderBookLinks();
}
async function renderBookLinks() {
  const out = $("bookOut"); out.innerHTML = "";
  const all = books.filter((b) => bookPdfs(b).length);
  if (!all.length) { out.appendChild(el("p", "sum", "Учебники ещё загружаются — загляни через несколько минут.")); return; }
  let urls = [];
  const paths = all.flatMap(bookPdfs);
  try { urls = await signedUrls(paths); } catch (e) { out.appendChild(el("p", "sum", "Не удалось получить ссылки. Проверь интернет.")); return; }
  const byPath = new Map(paths.map((p, i) => [p, urls[i]]));
  // Сначала английский, потом испанский, потом остальное — заголовок предмета и под ним его учебники.
  const order = (c) => (c === "Английский" ? 0 : c === "Испанский" ? 1 : 2);
  const courses = [...new Set(all.map((b) => b.course || "Другое"))].sort((a, c) => order(a) - order(c) || a.localeCompare(c, "ru"));
  courses.forEach((c) => {
    const h = el("h4", "bhead", c); h.style.setProperty("--cc", courseColor(c)); out.appendChild(h);
    all.filter((b) => (b.course || "Другое") === c).sort((a, d) => a.title.localeCompare(d.title, "ru")).forEach((b) => {
      const it = el("div", "bitem"); const files = bookPdfs(b);
      files.forEach((f, i) => { const a = el("a", null, b.title + (files.length > 1 ? " — часть " + (i + 1) : "") + " →"); a.href = byPath.get(f); a.target = "_blank"; a.rel = "noopener"; it.appendChild(a); });
      out.appendChild(it);
    });
  });
}
/* ---------- Плитки разделов: открыт один раздел за раз ---------- */
document.querySelectorAll(".tool").forEach((t) => t.addEventListener("click", () => {
  const id = t.dataset.p, panel = $(id), open = panel.hidden;
  document.querySelectorAll(".panel").forEach((p) => { p.hidden = true; });
  document.querySelectorAll(".tool").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-expanded", "false"); });
  if (!open) return;
  panel.hidden = false; t.classList.add("on"); t.setAttribute("aria-expanded", "true");
  if (id === "esBox" || id === "enBox") renderVocab(panel);
  if (id === "primBox") renderPrim();
  if (id === "booksBox") renderBookLinks();
  if (panel.dataset.course) renderCourse(panel);
}));
// Учебники, Примаков и «Вся лексика» сворачиваются сами, когда их пролистали вниз к заданиям.
// Экран при этом не прыгает: задания остаются там же, где были.
const AUTO_CLOSE = ["booksBox", "primBox", "esBox", "enBox"];
let autoCloseTick = false;
window.addEventListener("scroll", () => {
  if (autoCloseTick) return; autoCloseTick = true;
  requestAnimationFrame(() => {
    autoCloseTick = false;
    const panel = AUTO_CLOSE.map($).find((p) => p && !p.hidden);
    if (!panel || panel.getBoundingClientRect().bottom > 0) return;
    const anchor = $("list"), before = anchor.getBoundingClientRect().top;
    panel.hidden = true;
    document.querySelectorAll(".tool").forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-expanded", "false"); });
    window.scrollBy(0, anchor.getBoundingClientRect().top - before);
  });
}, { passive: true });

/* ---------- Слова ---------- */
// Слова по полочкам: раздел (учебник/юнит или большая тема) → тема → слова. Всё свёрнуто, открывается по нажатию.
function vocabTree(list) {
  const groups = [];
  list.forEach((v) => {
    const gName = v.source || "Слова";
    let g = groups.find((x) => x.name === gName);
    if (!g) { g = { name: gName, topics: [] }; groups.push(g); }
    const um = /^U\d+\s*·\s*(.+)$/.exec(v.set_name);
    const tName = um ? um[1] : v.set_name;
    let t = g.topics.find((x) => x.set === v.set_name);
    if (!t) { t = { set: v.set_name, name: tName, unit: Number((/^Unit\s+(\d+)/.exec(v.set_name) || [])[1]) || 0, words: [] }; g.topics.push(t); }
    t.words.push(v);
  });
  // Английский: внутри раздела — по номеру юнита (порядок «слов на сегодня» от этого не меняется).
  groups.forEach((g) => g.topics.sort((x, y) => (x.unit && y.unit ? x.unit - y.unit : 0)));
  return groups;
}
function wordWord(n) { const a = n % 10, b = n % 100; return n + " " + (a === 1 && b !== 11 ? "слово" : a >= 2 && a <= 4 && (b < 12 || b > 14) ? "слова" : "слов"); }
function renderWords(ul, words, hide) {
  words.forEach((v) => {
    const li = el("li", "vrow" + (hide ? " hid" : ""));
    li.append(el("span", "vw", v.word), el("span", "vt", v.translation));
    if (v.example) li.appendChild(el("span", "vex", v.example));
    li.addEventListener("click", () => li.classList.toggle("hid"));
    ul.appendChild(li);
  });
}
function renderVocab(panel) {
  const lang = panel.dataset.lang, q = panel.querySelector("input[type=search]").value.trim().toLowerCase();
  const hide = panel.querySelector("input[type=checkbox]").checked, out = panel.querySelector(".vout");
  // Запоминаем, что было открыто, чтобы галочка «Скрыть перевод» не сворачивала всё обратно.
  const wasOpen = new Set([...out.querySelectorAll("details[open]")].map((d) => d.dataset.key));
  out.innerHTML = "";
  const list = vocab.filter((v) => v.lang === lang && (!q || (v.word + " " + v.translation).toLowerCase().includes(q)));
  if (!list.length) { out.appendChild(el("p", "sum", q ? "Не найдено." : "Слов пока нет — пришли список или набор из Quizlet человеку, имя которого начинается на «А» и заканчивается на «Я».")); return; }
  const groups = vocabTree(list), single = groups.length === 1;
  let book = null;
  groups.forEach((g) => {
    // «Учебник — раздел»: название учебника один раз заголовком, под ним компактные разделы.
    const bm = /^(.+?)\s+—\s+(.+)$/.exec(g.name);
    const bName = bm ? bm[1] : null, gName = bm ? bm[2] : g.name;
    if (bName && bName !== book) { book = bName; out.appendChild(el("h4", "vbook", "📘 " + bName)); }
    const gd = el("details", "vgrp"); gd.dataset.key = "g:" + g.name; gd.open = !!q || single || wasOpen.has(gd.dataset.key);
    const gs = el("summary"); gs.append(el("b", null, gName), el("span", "vcnt", String(g.topics.reduce((n, t) => n + t.words.length, 0))));
    gd.appendChild(gs);
    g.topics.forEach((t) => {
      const td = el("details", "vtopic"); td.dataset.key = "t:" + t.set;
      const ts = el("summary"); ts.append(el("span", null, t.name), el("span", "vcnt", String(t.words.length)));
      td.appendChild(ts);
      const ul = el("ul", "vlist"); td.appendChild(ul);
      // Слова рисуем только при открытии темы — так список не тормозит.
      const fill = () => { if (!ul.childElementCount) renderWords(ul, t.words, hide); };
      if (q || wasOpen.has(td.dataset.key)) { td.open = true; fill(); }
      td.addEventListener("toggle", () => { if (td.open) fill(); });
      gd.appendChild(td);
    });
    out.appendChild(gd);
  });
}
document.querySelectorAll(".panel.vocab").forEach((p) => {
  let t; p.querySelector("input[type=search]").addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => renderVocab(p), 200); });
  p.querySelector("input[type=checkbox]").addEventListener("change", () => renderVocab(p));
});


/* ---------- Повтори слова: 15 слов на язык — 5 новых, 5 вчерашних, 5 позавчерашних; плюс пара случайных из пройденного ---------- */
// День считается от личной даты старта (хранится в профиле пользователя — одинаково на телефоне и ноутбуке).
const DAILY_NEW = 5, WINDOW_DAYS = 3, DAILY_RANDOM = 3;
let dailyLang = "es", dailyOpen = null;
try { dailyLang = localStorage.getItem("kdz-daily-lang") || "es"; } catch (e) {}
function vocabStart() {
  const md = (user && user.user_metadata) || {};
  return md.vocab_start || null;
}
async function ensureVocabStart() {
  if (!user || vocabStart()) return;
  const { data } = await sb.auth.updateUser({ data: { vocab_start: today } });
  if (data && data.user) user = data.user;
}
function dayIndex() {
  const st = vocabStart() || today;
  return Math.max(0, Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(st + "T00:00:00Z")) / DAY));
}
function langWords(lang) { return vocab.filter((v) => v.lang === lang && !/^auto:/.test(v.id || "")); }
/** Слова окна: [сегодняшние 5, вчерашние 5, позавчерашние 5] + случайные из уже ушедших. Когда слова заканчиваются — начинаем круг заново. */
function dailyWindow(lang) {
  const all = langWords(lang); if (!all.length) return [];
  const n = dayIndex(), groups = [];
  for (let k = 0; k < WINDOW_DAYS && n - k >= 0; k++) {
    const start = ((n - k) * DAILY_NEW) % all.length;
    const g = []; for (let i = 0; i < DAILY_NEW && i < all.length; i++) g.push(all[(start + i) % all.length]);
    groups.push({ age: k, words: g });
  }
  // Уже ушедшие из окна слова иногда возвращаются: каждый день свои (случайно, но одинаково на всех устройствах).
  const passed = Math.min(all.length, Math.max(0, (n - WINDOW_DAYS + 1) * DAILY_NEW));
  if (passed > 0) {
    let seed = 0; for (const c of today + lang) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const picked = new Set();
    while (picked.size < Math.min(DAILY_RANDOM, passed)) picked.add(Math.floor(rnd() * passed));
    groups.push({ age: 3, words: [...picked].map((i) => all[i]) });
  }
  return groups;
}
// Перевод всегда появляется в одном месте — в плашке внизу экрана. Сами слова не двигаются.
var wordBar = el("div", "wordbar"); wordBar.hidden = true; wordBar.setAttribute("role", "status");
document.body.appendChild(wordBar);
wordBar.addEventListener("click", (ev) => { ev.stopPropagation(); hideWordBar(); });
function hideWordBar() {
  wordBar.hidden = true;
  document.querySelectorAll("#dailyOut .dword:not(.hid)").forEach((x) => x.classList.add("hid"));
}
function showWordBar(li, v) {
  hideWordBar();
  li.classList.remove("hid");
  wordBar.innerHTML = "";
  const x = el("span", "wbx", "✕");
  wordBar.append(el("span", "vw", v.word), el("span", "vt", v.translation));
  if (v.example) wordBar.appendChild(el("span", "vex", v.example));
  wordBar.appendChild(x);
  wordBar.hidden = false;
}
document.addEventListener("click", () => { if (!wordBar.hidden) hideWordBar(); });
function renderDaily() {
  const box = $("dailyBox"); if (!box) return;
  const langs = ["es", "en"].filter((l) => langWords(l).length);
  box.hidden = !langs.length || !user;
  if (box.hidden) return;
  if (!langs.includes(dailyLang)) dailyLang = langs[0];
  if (dailyOpen && !langs.includes(dailyOpen)) dailyOpen = null;
  // Две карточки: Испанский / Английский. Нажала — под ними раскрываются слова, ещё раз — сворачиваются.
  const cards = $("dailyCards"); cards.innerHTML = "";
  langs.forEach((l) => {
    const win = dailyWindow(l), n = win.reduce((k, g) => k + g.words.length, 0), fresh = win[0] ? win[0].words.length : 0;
    const b = el("button", "dcard" + (l === dailyOpen ? " on" : ""));
    b.type = "button"; b.style.setProperty("--tc", l === "es" ? "var(--k-es)" : "var(--k-en)");
    b.setAttribute("aria-expanded", String(l === dailyOpen));
    b.append(el("span", "dflag", l === "es" ? "🇪🇸" : "🇬🇧"), el("span", "dname", l === "es" ? "Испанский" : "Английский"),
      el("span", "dsub", wordWord(n)));
    b.addEventListener("click", () => {
      dailyOpen = dailyOpen === l ? null : l; dailyLang = l;
      try { localStorage.setItem("kdz-daily-lang", l); } catch (e) {}
      renderDaily();
    });
    cards.appendChild(b);
  });
  const body = $("dailyBody"); body.hidden = !dailyOpen;
  if (typeof wordBar !== "undefined") wordBar.hidden = true;
  if (!dailyOpen) return;
  const out = $("dailyOut"); out.innerHTML = "";
  out.style.setProperty("--tc", dailyOpen === "es" ? "var(--k-es)" : "var(--k-en)");
  // 10 новых (сегодняшние 5 + вчерашние 5) · 5 старых (позавчерашние, последний день) · 3 давно изученных.
  const win = dailyWindow(dailyOpen), byAge = (a) => (win.find((g) => g.age === a) || { words: [] }).words;
  [
    { age: 0, label: "Новые — учим", words: byAge(0).concat(byAge(1)) },
    { age: 1, label: "Изучали раньше — повтори", words: byAge(2) },
    { age: 3, label: "Давно изученные — вспомни", words: byAge(3) },
  ].filter((g) => g.words.length).forEach((g) => {
    out.appendChild(el("div", "dage", g.label + " · " + g.words.length));
    const ul = el("ul", "dlist age" + g.age);
    g.words.forEach((v) => {
      // Видно только испанское слово; перевод, тема и пример — по нажатию.
      const li = el("li", "dword hid");
      li.appendChild(el("span", "vw", v.word));
      li.title = "Нажми, чтобы увидеть перевод";
      li.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (li.classList.contains("hid")) showWordBar(li, v); else hideWordBar();
      });
      ul.appendChild(li);
    });
    out.appendChild(ul);
  });
}

/* ---------- Случайное повторение: иногда всплывает уже пройденное слово ---------- */
function maybeRecall() {
  if (!user || document.hidden) return;
  let last = 0; try { last = Number(localStorage.getItem("kdz-recall-at") || 0); } catch (e) {}
  if (Date.now() - last < 2 * 3600 * 1000 || Math.random() > 0.35) return;
  const all = langWords(dailyLang); const passed = Math.min(all.length, Math.max(0, (dayIndex() - WINDOW_DAYS + 1) * DAILY_NEW));
  const pool = all.slice(0, passed);
  if (!pool.length) return;
  const v = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem("kdz-recall-at", String(Date.now())); } catch (e) {}
  const card = $("recall"); $("recallW").textContent = v.word; $("recallT").textContent = v.translation;
  card.classList.add("hid"); card.hidden = false;
}
$("recall").addEventListener("click", (e) => {
  if (e.target.id === "recallX") { $("recall").hidden = true; return; }
  $("recall").classList.toggle("hid");
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(maybeRecall, 4000 + Math.random() * 20000); });

/* ---------- Материалы для Примакова ---------- */
const PRIM_COURSES = ["ПОСИ-2", "Матстатистика"];
/** Мини-разметка конспекта: заголовки #, списки, **жирный**, *курсив*, таблицы |…|, цитаты >. */
function mdToHtml(md) {
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inl = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
  const out = []; let list = null, table = null;
  const flush = () => { if (list) { out.push(`<${list.t}>` + list.items.map((x) => `<li>${x}</li>`).join("") + `</${list.t}>`); list = null; }
    if (table) { out.push("<div class='kt'><table>" + table.map((r, i) => "<tr>" + r.map((c) => i ? `<td>${inl(c)}</td>` : `<th>${inl(c)}</th>`).join("") + "</tr>").join("") + "</table></div>"); table = null; } };
  md.split("\n").forEach((line) => {
    const l = line.trim(); let m;
    if (/^\|/.test(l)) { if (/^\|[\s|:-]+\|$/.test(l)) return; if (list) { const t = table; table = null; flush(); table = t; } (table = table || []).push(l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim())); return; }
    if ((m = /^(#{1,3})\s+(.*)$/.exec(l))) { flush(); out.push(`<h${m[1].length + 2}>${inl(m[2])}</h${m[1].length + 2}>`); return; }
    if ((m = /^[-•]\s+(.*)$/.exec(l)) || (m = /^\d+[.)]\s+(.*)$/.exec(l))) { const t = /^\d/.test(l) ? "ol" : "ul"; if (table) flush(); if (!list || list.t !== t) { flush(); list = { t, items: [] }; } list.items.push(inl(m[1])); return; }
    if (list && l && /^\S/.test(line) === false) { list.items[list.items.length - 1] += "<br>" + inl(l); return; }
    flush();
    if (!l) return;
    if ((m = /^>\s*(.*)$/.exec(l))) { out.push(`<p class='kq'>${inl(m[1])}</p>`); return; }
    out.push(`<p>${inl(l)}</p>`);
  });
  flush();
  return out.join("");
}
/** Слайды лекции — компактной сеткой миниатюр; нажатие открывает слайд на весь экран (листать ‹ ›). */
function slideTexts(course, day) {
  const r = res.find((x) => x.block === "slides" && x.title === course + "|" + day);
  try { return r ? JSON.parse(r.note) : {}; } catch (e) { return {}; }
}
async function renderSlides(box, items, texts = {}) {
  let urls = [];
  try { urls = await signedUrls(items.map((m) => m.path).filter(Boolean)); } catch (e) {}
  const byPath = new Map(items.filter((m) => m.path).map((m, i) => [m.path, urls[i]]));
  const grid = el("div", "slides");
  items.forEach((m, i) => {
    const card = el("div", "slidecard");
    const b = el("button", "slide"); b.type = "button";
    const u = m.path ? byPath.get(m.path) : "";
    if (u) { const im = el("img"); im.src = u; im.loading = "lazy"; im.alt = "Слайд " + (i + 1); b.appendChild(im); }
    else b.appendChild(el("span", "slide-na", "нет фото"));
    b.appendChild(el("span", "slide-n", String(i + 1)));
    b.addEventListener("click", () => openSlide(items, byPath, i, texts));
    card.appendChild(b);
    // Текст слайда рядом с фото: чистый (собранный вручную), иначе распознанный автоматически.
    const t = texts[String(m.message_id)] || m.text || "";
    if (t) card.appendChild(el("div", "slide-t" + (texts[String(m.message_id)] ? "" : " raw"), t));
    grid.appendChild(card);
  });
  box.appendChild(grid);
}
function openSlide(items, byPath, i, texts = {}) {
  let v = $("slideView");
  if (!v) { v = el("div", "slideview"); v.id = "slideView"; document.body.appendChild(v); }
  const show = (k) => {
    i = (k + items.length) % items.length; const m = items[i];
    v.innerHTML = "";
    const bar = el("div", "sv-bar");
    const prev = el("button", "sv-btn", "‹"), next = el("button", "sv-btn", "›"), close = el("button", "sv-btn", "✕");
    [prev, next, close].forEach((x) => { x.type = "button"; });
    bar.append(prev, el("span", "sv-t", "Слайд " + (i + 1) + " из " + items.length), next, close);
    v.appendChild(bar);
    const u = m.path ? byPath.get(m.path) : "";
    if (u) { const im = el("img", "sv-img"); im.src = u; im.alt = "Слайд " + (i + 1); v.appendChild(im); }
    const clean = texts[String(m.message_id)];
    if (clean) v.appendChild(el("div", "sv-text", clean));
    else if (m.text) { const d = el("details", "ocr sv-ocr"); d.appendChild(el("summary", null, "Текст со слайда (распознан автоматически)")); d.appendChild(el("p", "sum", m.text)); v.appendChild(d); }
    prev.onclick = () => show(i - 1); next.onclick = () => show(i + 1);
    close.onclick = () => { v.hidden = true; document.body.classList.remove("noscroll"); };
  };
  v.hidden = false; document.body.classList.add("noscroll"); show(i);
  // Свайп влево/вправо — следующий/предыдущий слайд.
  let x0 = null;
  v.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
  v.ontouchend = (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) show(dx < 0 ? i + 1 : i - 1); };
}
document.addEventListener("keydown", (e) => {
  const v = $("slideView"); if (!v || v.hidden) return;
  const b = v.querySelectorAll(".sv-btn");
  if (e.key === "ArrowLeft") b[0].click(); else if (e.key === "ArrowRight") b[1].click(); else if (e.key === "Escape") b[2].click();
});
/** Лекции предмета: фото из его темы в «Конторском ДЗ». Дата — из сообщения-метки перед фото («20.09»),
 *  без метки — день пересылки. Разделы по датам, внутри — слайды с распознанным текстом. */
function renderLectures(out, course) {
  const photos = mats.filter((m) => m.course === course && m.kind === "photo").sort((x, y) => Date.parse(x.posted_at) - Date.parse(y.posted_at));
  const byDay = new Map();
  photos.forEach((m) => {
    const d = /^\d{4}-\d\d-\d\d$/.test(m.lecture || "") ? m.lecture : new Date(Date.parse(m.posted_at) + 3 * 3600000).toISOString().slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, { day: d, items: [] });
    byDay.get(d).items.push(m);
  });
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  if (days.length) {
    out.appendChild(el("div", "vset", "Лекции"));
    days.forEach((g) => {
      const x = new Date(g.day + "T00:00:00Z");
      const sec = el("details", "lecture");
      sec.appendChild(el("summary", null, "Лекция " + x.getUTCDate() + " " + MON[x.getUTCMonth()] + " — " + g.items.length + " фото"));
      const k = res.find((r) => r.block === "konspekt" && r.title === course + "|" + g.day);
      if (k && k.note) { const d = el("details", "ocr konspekt"); d.appendChild(el("summary", null, "📝 Конспект лекции")); const body = el("div", "kbody"); body.innerHTML = mdToHtml(k.note); d.appendChild(body); sec.appendChild(d); }
      const all = g.items.map((m, k) => m.text ? "Слайд " + (k + 1) + "\n" + m.text : "").filter(Boolean).join("\n\n— — —\n\n");
      if (all) { const d = el("details", "ocr"); d.appendChild(el("summary", null, "Весь текст лекции")); d.appendChild(el("p", "sum", all)); sec.appendChild(d); }
      sec.addEventListener("toggle", () => { if (sec.open && !sec.dataset.loaded) { sec.dataset.loaded = "1"; renderSlides(sec, g.items, slideTexts(course, g.day)); } });
      out.appendChild(sec);
    });
  }
  return days;
}
/** Плитка предмета (ММСИ, маркетинг, анализ данных, политсоц): лекции + прочие файлы из Telegram. */
function renderCourse(panel) {
  const course = panel.dataset.course, out = panel.querySelector(".cout"); out.innerHTML = "";
  const days = renderLectures(out, course);
  const files = mats.filter((m) => m.course === course && m.kind !== "photo").slice(0, 30);
  if (files.length) { out.appendChild(el("div", "vset", "Файлы и ссылки")); const box = el("div"); out.appendChild(box); renderMats(box, files, false); }
  if (!days.length && !files.length) out.appendChild(el("p", "sum", "Пока пусто — перешли фото и файлы в тему «" + panel.querySelector("h3").textContent + "» группы «Конторское ДЗ»."));
}
async function renderPrim() {
  const out = $("primOut"); out.innerHTML = "";
  const list = res.filter((r) => r.block === "primakov");
  let urls = [];
  try { urls = await signedUrls(list.filter((r) => r.path).map((r) => r.path)); } catch (e) {}
  const byPath = new Map(list.filter((r) => r.path).map((r, i) => [r.path, urls[i]]));
  list.forEach((r) => {
    const it = el("div", "mat"); const href = r.path ? byPath.get(r.path) : r.url;
    if (href) { const a = el("a", null, r.title + " →"); a.href = href; a.target = "_blank"; a.rel = "noopener"; it.appendChild(a); }
    else it.appendChild(el("b", null, r.title));
    if (r.note) it.appendChild(el("p", "sum", r.note));
    out.appendChild(it);
  });
  const days = renderLectures(out, "ПОСИ-2");
  const tg = mats.filter((m) => PRIM_COURSES.includes(m.course) && !(m.course === "ПОСИ-2" && m.kind === "photo")).slice(0, 15);
  if (tg.length) { out.appendChild(el("div", "vset", "Файлы из Telegram (ПОСИ, матстатистика)")); const box = el("div"); out.appendChild(box); renderMats(box, tg, true); }
  if (!list.length && !tg.length && !days.length) out.appendChild(el("p", "sum", "Пока пусто."));
}
function renderCounts() {
  $("esCnt").textContent = vocab.filter((v) => v.lang === "es").length || "";
  $("enCnt").textContent = vocab.filter((v) => v.lang === "en").length || "";
  $("primCnt").textContent = (res.filter((r) => r.block === "primakov").length + mats.filter((m) => m.course === "ПОСИ-2").length) || "";
  document.querySelectorAll("[data-cnt]").forEach((x) => { x.textContent = mats.filter((m) => m.course === x.dataset.cnt).length || ""; });
}

function setStatus(t) { $("status").textContent = t; }

/* ---------- Загрузка данных ---------- */
let loading = false;
// Supabase отдаёт не больше 1000 строк за запрос — длинные таблицы (слова) читаем по страницам.
async function selectAll(make) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const r = await make().range(from, from + 999);
    if (r.error) return { data: null, error: r.error };
    all.push(...(r.data || [])); if (!r.data || r.data.length < 1000) return { data: all, error: null };
  }
}
async function load() {
  if (!user || loading) return;
  loading = true;
  try {
    const [h, d, bk, mt, vc, rs] = await Promise.all([
      sb.from("homework").select("id,course,title,summary,due,link,telegram,pages,created_at").order("due", { ascending: true, nullsFirst: false }),
      sb.from("done").select("homework_id"),
      sb.from("books").select("slug,title,course,aliases,pages"),
      sb.from("materials").select("id,chat_id,message_id,course,kind,file_name,caption,path,duration,posted_at,tg_link,text,lecture").order("posted_at", { ascending: false }).limit(1000),
      selectAll(() => sb.from("vocab").select("lang,set_name,source,word,translation,example,sort").order("sort").order("id")),
      sb.from("resources").select("block,title,note,url,path,sort").order("sort"),
    ]);
    if (!vc.error) { vocab = vc.data || []; lsSet("kdz-vocab", vocab); }
    if (!rs.error) { res = rs.data || []; lsSet("kdz-res", res); }
    // «#lecture» — служебные метки даты лекции от бота, сами по себе не показываем.
    if (!mt.error) { mats = (mt.data || []).filter((m) => m.file_name !== "#lecture"); lsSet("kdz-mat", mats); }
    if (!bk.error) { books = bk.data || []; lsSet("kdz-books", books); }
    if (h.error) throw h.error;
    if (d.error) throw d.error;
    hw = h.data || [];
    mine = new Set((d.data || []).map((r) => r.homework_id));
    lsSet("kdz-hw", hw); lsSet("kdz-done", [...mine]);
    const t = new Date();
    setStatus("Обновлено в " + t.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) + ". Список обновляется сам.");
    if (!hw.length) setStatus("Заданий пока нет — или твоей почты ещё нет в списке группы. Напиши человеку, имя которого начинается на «А» и заканчивается на «Я».");
  } catch (e) {
    setStatus(navigator.onLine ? "Не удалось обновить задания. Показана последняя сохранённая версия." : "Нет интернета — показана последняя сохранённая версия.");
  } finally {
    loading = false;
    today = todayIso();
    render();
  }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });
setInterval(() => { if (document.visibilityState === "visible") load(); }, 5 * 60 * 1000);

/* ---------- Вход по почте и паролю (короткий логин без «@» тоже работает) ---------- */
// Логин — короткое имя; в Supabase он хранится как «имя@LOGIN_DOMAIN» (не настоящая почта, письма не отправляются).
const LOGIN_DOMAIN = cfg.loginDomain;
// Можно вводить по-русски: «Маша» → masha.
const TR = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
const translit = (t) => [...t].map((c) => (c in TR ? TR[c] : c)).join("");
const toEmail = (login) => { const l = translit(login.trim().toLowerCase()).replace(/\s+/g, ""); return l.includes("@") ? l : l + "@" + LOGIN_DOMAIN; };
const toLogin = (email) => (email || "").endsWith("@" + LOGIN_DOMAIN) ? email.slice(0, -LOGIN_DOMAIN.length - 1) : email || "";
function loginMsg(t, err) { const m = $("loginMsg"); m.textContent = t || ""; m.classList.toggle("err", !!err); }
function showLogin() {
  // Подставляем последнюю почту, чтобы при повторном входе оставалось ввести только пароль.
  try { const last = localStorage.getItem("kdz-last-email"); if (last && !$("loginIn").value) $("loginIn").value = last; } catch (e) {}
  $("login").hidden = false; $("app").hidden = true;
  $("upd").textContent = "Закрытое приложение группы ИМОЗ-24-2.";
}
function showApp() {
  $("login").hidden = true; $("app").hidden = false;
  $("upd").textContent = "Пары, сроки сдачи и страницы учебников. Отметки «сделано» видишь только ты.";
  $("who").textContent = toLogin(user.email);
  render(); load();
  ensureVocabStart().then(renderDaily).catch(() => {});
  setTimeout(maybeRecall, 8000 + Math.random() * 30000);
}
$("loginForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = $("loginForm").querySelector("button"); btn.disabled = true;
  loginMsg("Входим…");
  const { error } = await sb.auth.signInWithPassword({ email: toEmail($("loginIn").value), password: $("pass").value });
  btn.disabled = false;
  if (!error) { loginMsg(""); $("pass").value = ""; try { localStorage.setItem("kdz-last-email", $("loginIn").value.trim()); } catch (e) {} return; }
  if (error.status === 400 || /invalid/i.test(error.message || "")) loginMsg("Неверная почта или пароль.", true);
  else if (error.status === 429) loginMsg("Слишком много попыток. Подожди пару минут.", true);
  else loginMsg(navigator.onLine ? "Не получилось войти (" + (error.message || error.status) + ")." : "Нет интернета.", true);
});
$("logoutBtn").addEventListener("click", async () => {
  if (!confirm("Выйти? Чтобы войти снова, понадобятся логин и пароль.")) return;
  await sb.auth.signOut();
  lsDel("kdz-hw"); lsDel("kdz-done"); lsDel("kdz-books"); lsDel("kdz-mat"); lsDel("kdz-vocab"); lsDel("kdz-res"); hw = []; books = []; mats = []; vocab = []; res = []; mine = new Set();
});

sb.auth.onAuthStateChange((event, session) => {
  const u = session ? session.user : null;
  const changed = (u && u.id) !== (user && user.id);
  user = u;
  if (!user) { showLogin(); return; }
  if (changed) showApp();
});

/* ---------- PWA ---------- */
const APP_VERSION = "63";
$("status").dataset.v = APP_VERSION;
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
      // Проверяем обновления при каждом открытии приложения.
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
      // Новая версия установилась — один раз перезагружаем страницу.
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
    } catch (e) {}
  });
}
