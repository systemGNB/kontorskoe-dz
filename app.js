"use strict";
/* Конторское ДЗ — клиент. Данные: Supabase (homework, done, хранилище scans). */

const cfg = window.KDZ_CONFIG;
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
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
let mine = new Set(lsGet("kdz-done", []));
let sel = null;
let view = new Date(today + "T00:00:00Z"); view.setUTCDate(1);
let user = null;

// Постоянные цвета предметов (совпадают с расписанием).
const COURSE_COLORS = {
  "Социология маркетинга": "--c1", "ММСИ": "--c2", "ПОСИ-2": "--c3",
  "Английский": "--c4", "Анализ данных в социологии": "--c5", "Испанский": "--c6",
};
function courseColor(c) {
  if (COURSE_COLORS[c]) return "var(" + COURSE_COLORS[c] + ")";
  let h = 0; for (const ch of c) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return "var(--c" + (1 + (h % 7)) + ")";
}
function badge(due) {
  if (!due) return ["без срока", "bn"];
  const g = gap(due);
  if (g < 0) return ["срок прошёл", "bn"];
  if (g === 0) return ["сдать сегодня", "b0"];
  if (g === 1) return ["сдать завтра", "b1"];
  return ["сдать через " + g + " " + plural(g, "день", "дня", "дней"), "b" + Math.min(g, 5)];
}

/* ---------- Календарь ---------- */
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
    const b = el("button", "day" + (d.getUTCMonth() !== view.getUTCMonth() ? " out" : "") + (ds === today ? " today" : "") + (ds === sel ? " sel" : ""));
    b.type = "button";
    b.setAttribute("aria-label", human(ds) + (items.length ? ": сдать " + items.length : ""));
    b.appendChild(el("span", "n", String(d.getUTCDate())));
    if (items.length) {
      const dots = el("span", "dots");
      items.forEach((x) => { const s = el("span", "dot"); s.style.setProperty("--cc", courseColor(x.course)); s.title = x.course; dots.appendChild(s); });
      b.appendChild(dots);
    }
    b.addEventListener("click", () => { sel = sel === ds ? null : ds; schedDate = null; render(); });
    g.appendChild(b);
  }
  const lg = $("legend"); lg.innerHTML = "";
  [...new Set(hw.map((x) => x.course))].sort().forEach((c) => {
    const s = el("span"); const d = el("span", "dot"); d.style.setProperty("--cc", courseColor(c)); s.append(d, c); lg.appendChild(s);
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

async function toggleDone(id, on, li, cb, onToggle) {
  if (on) mine.add(id); else mine.delete(id);
  lsSet("kdz-done", [...mine]); li.classList.toggle("done", on); onToggle();
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
  if (x.telegram) b.appendChild(el("span", "tg", "Из Telegram: " + x.telegram));
  if (x.link) { const a = el("a", null, "Открыть в Google Классе →"); a.href = x.link; a.target = "_blank"; a.rel = "noopener"; b.appendChild(a); }
  li.append(cell, b);
  return li;
}

function subjectBlocks(items, box) {
  const by = {};
  items.forEach((x) => (by[x.course] = by[x.course] || []).push(x));
  const key = (l) => Math.min(...l.map((x) => (x.due ? gap(x.due) : 999)));
  Object.entries(by).sort((a, b) => key(a[1]) - key(b[1]) || a[0].localeCompare(b[0], "ru")).forEach(([course, list]) => {
    list.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.title.localeCompare(b.title, "ru"));
    const sec = el("section", "subj"); sec.style.setProperty("--cc", courseColor(course));
    const head = el("header", "subj-h"); const cnt = el("span", "cnt");
    const upd = () => { const d = list.filter((x) => mine.has(x.id)).length; cnt.textContent = "сделано " + d + " из " + list.length; sec.classList.toggle("all", d === list.length); };
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
    upd(); box.appendChild(sec);
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
    const li = el("li", "pair"); li.style.setProperty("--cc", p.hw ? courseColor(p.hw) : "var(--line)");
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
  renderCal(); renderSched(); renderBooks();
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

/* ---------- Учебники: любая страница ---------- */
let vb = null, vp = null;
function renderBooks() {
  const box = $("booksBox"), sel2 = $("bookSel");
  const avail = books.filter((b) => b.pages && Object.keys(b.pages).length);
  box.hidden = !avail.length;
  if (!avail.length) return;
  const cur = sel2.value;
  sel2.innerHTML = "";
  avail.forEach((b) => { const o = el("option", null, b.title); o.value = b.slug; sel2.appendChild(o); });
  if (avail.some((b) => b.slug === cur)) sel2.value = cur;
}
function bookNums(b) { return Object.keys(b.pages).map(Number).sort((a, c) => a - c); }
async function showBookPage(n) {
  const b = books.find((x) => x.slug === $("bookSel").value); if (!b) return;
  const nums = bookNums(b), out = $("bookOut"); out.innerHTML = "";
  if (!b.pages[String(n)]) { out.appendChild(el("p", "sum", "В этом файле есть страницы " + nums[0] + "–" + nums[nums.length - 1] + ".")); return; }
  vb = b; vp = n; $("pageIn").value = n;
  try {
    const [u] = await signedUrls([b.pages[String(n)]]);
    const f = el("figure"); const im = el("img"); im.src = u; im.alt = b.title + ", стр. " + n;
    f.append(im, el("figcaption", null, b.title + ", стр. " + n)); out.appendChild(f);
  } catch (e) { out.appendChild(el("p", "sum", "Не удалось загрузить страницу. Проверь интернет.")); }
}
function stepPage(d) {
  const b = books.find((x) => x.slug === $("bookSel").value); if (!b) return;
  const nums = bookNums(b); const i = nums.indexOf(vb === b ? vp : nums[0]);
  const n = nums[Math.min(nums.length - 1, Math.max(0, (i < 0 ? 0 : i) + d))]; showBookPage(n);
}
$("pageForm").addEventListener("submit", (e) => { e.preventDefault(); showBookPage(Number($("pageIn").value)); });
$("prevP").addEventListener("click", () => stepPage(-1));
$("nextP").addEventListener("click", () => stepPage(1));
$("bookSel").addEventListener("change", () => { $("bookOut").innerHTML = ""; vb = null; });

function setStatus(t) { $("status").textContent = t; }

/* ---------- Загрузка данных ---------- */
let loading = false;
async function load() {
  if (!user || loading) return;
  loading = true;
  try {
    const [h, d, bk] = await Promise.all([
      sb.from("homework").select("id,course,title,summary,due,link,telegram,pages").order("due", { ascending: true, nullsFirst: false }),
      sb.from("done").select("homework_id"),
      sb.from("books").select("slug,title,course,aliases,pages"),
    ]);
    if (!bk.error) { books = bk.data || []; lsSet("kdz-books", books); }
    if (h.error) throw h.error;
    if (d.error) throw d.error;
    hw = h.data || [];
    mine = new Set((d.data || []).map((r) => r.homework_id));
    lsSet("kdz-hw", hw); lsSet("kdz-done", [...mine]);
    const t = new Date();
    setStatus("Обновлено в " + t.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) + ". Список обновляется сам.");
    if (!hw.length) setStatus("Заданий пока нет — или твоей почты ещё нет в списке группы. Напиши старосте.");
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

/* ---------- Вход по коду ---------- */
let pendingEmail = "";
function loginMsg(t, err) { const m = $("loginMsg"); m.textContent = t || ""; m.classList.toggle("err", !!err); }
function showLogin() {
  $("login").hidden = false; $("app").hidden = true;
  $("upd").textContent = "Закрытое приложение группы ИМОЗ-24-2. Вход — по коду на почту.";
}
function showApp() {
  $("login").hidden = true; $("app").hidden = false;
  $("upd").textContent = "Пары, сроки сдачи и страницы учебников. Отметки «сделано» видишь только ты.";
  $("who").textContent = user.email || "";
  render(); load();
}

$("emailForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = $("email").value.trim().toLowerCase();
  const btn = ev.submitter || $("emailForm").querySelector("button"); btn.disabled = true;
  loginMsg("Отправляем код…");
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname } });
  btn.disabled = false;
  if (error) {
    const m = error.message || "";
    if (/списке|403|not allowed|hook/i.test(m) || error.status === 403 || error.status === 422) loginMsg("Этой почты нет в списке группы. Напиши старосте.", true);
    else if (/rate|seconds|security purposes/i.test(m) || error.status === 429) loginMsg("Код уже отправлен недавно. Подожди минуту и попробуй снова.", true);
    else loginMsg("Не получилось отправить код: " + m, true);
    return;
  }
  pendingEmail = email; $("sentTo").textContent = email;
  $("emailForm").hidden = true; $("codeForm").hidden = false; $("code").value = ""; $("code").focus();
  loginMsg("Письмо отправлено. Введи код из него — или просто нажми ссылку в письме (открой её в этом же браузере).");
});
$("codeForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const token = $("code").value.replace(/\D/g, "");
  const btn = ev.submitter || $("codeForm").querySelector("button.primary"); btn.disabled = true;
  loginMsg("Проверяем…");
  const { error } = await sb.auth.verifyOtp({ email: pendingEmail, token, type: "email" });
  btn.disabled = false;
  if (error) { loginMsg("Код не подошёл или устарел. Проверь цифры или запроси новый.", true); return; }
  loginMsg("");
});
$("backBtn").addEventListener("click", () => { $("codeForm").hidden = true; $("emailForm").hidden = false; loginMsg(""); });
$("logoutBtn").addEventListener("click", async () => {
  if (!confirm("Выйти? Чтобы войти снова, понадобится код из письма.")) return;
  await sb.auth.signOut();
  lsDel("kdz-hw"); lsDel("kdz-done"); lsDel("kdz-books"); hw = []; books = []; mine = new Set();
});

// Ошибка из ссылки в письме (например, ссылка устарела).
if (/error_description=/.test(location.hash)) {
  const p = new URLSearchParams(location.hash.slice(1));
  setTimeout(() => loginMsg("Ссылка не сработала: " + (p.get("error_description") || "").replace(/\+/g, " ") + ". Запроси новое письмо.", true), 0);
  history.replaceState(null, "", location.pathname);
}

sb.auth.onAuthStateChange((event, session) => {
  const u = session ? session.user : null;
  const changed = (u && u.id) !== (user && user.id);
  user = u;
  if (!user) { showLogin(); return; }
  if (changed) showApp();
});

/* ---------- PWA ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}
