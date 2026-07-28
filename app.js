import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { marked } from "https://esm.sh/marked@12";
import DOMPurify from "https://esm.sh/dompurify@3";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Every link inside rendered brief markdown opens in a new tab safely.
// DOMPurify already strips javascript:/data: hrefs and event-handler
// attributes by default; this hook only adds target/rel on top of that.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

// i18n ---------------------------------------------------------------------
const I18N = {
  en: {
    dir: "ltr",
    tagline: "Your daily AI & tech news digest",
    tabNews: "News digest",
    tabModels: "Model releases",
    tabBrief: "Intelligence Brief",
    searchPlaceholder: "Filter by keyword, source…",
    refresh: "Refresh",
    refreshTitle: "Reload the latest items",
    langToggle: "العربية",
    langToggleTitle: "التبديل إلى العربية",
    today: "Today",
    yesterday: "Yesterday",
    undated: "Undated",
    nothingTitle: "Nothing to show",
    emptyNews: "No news items yet. The daily digest will populate this table each morning.",
    emptyModels: "No model releases recorded yet.",
    emptyBrief: "No intelligence brief yet. It will be generated each morning.",
    noMatch: (q) => `No items match “${q}”.`,
    items: (n) => `${n} item${n === 1 ? "" : "s"}`,
    errorTitle: "Couldn’t load the digest",
    errorRls: "The table is protected by Row Level Security and the public key isn’t allowed to read it yet. Add a read policy for the <code>anon</code> role (see the project README).",
    errorGeneric: "There was a problem reaching Supabase.",
    footer: "Data from Supabase · Digest generated daily",
    footerLink: "view raw table info",
    briefTitle: "Daily Intelligence Brief",
    scoreGlobalRisk: "Global Risk",
    scoreMarketRisk: "Market Risk",
    scoreAiCompetition: "AI Competition",
    scoreBusinessOpportunity: "Business Opportunity",
    recommendedFocus: "Recommended focus",
    readFullBrief: "Read full brief",
  },
  ar: {
    dir: "rtl",
    tagline: "موجزك اليومي لأخبار الذكاء الاصطناعي والتقنية",
    tabNews: "موجز الأخبار",
    tabModels: "إصدارات النماذج",
    tabBrief: "الموجز الاستخباراتي",
    searchPlaceholder: "تصفية حسب كلمة مفتاحية أو مصدر…",
    refresh: "تحديث",
    refreshTitle: "إعادة تحميل أحدث العناصر",
    langToggle: "English",
    langToggleTitle: "Switch to English",
    today: "اليوم",
    yesterday: "أمس",
    undated: "بدون تاريخ",
    nothingTitle: "لا يوجد شيء لعرضه",
    emptyNews: "لا توجد أخبار بعد. سيقوم الموجز اليومي بتعبئة هذا الجدول كل صباح.",
    emptyModels: "لم تُسجَّل أي إصدارات نماذج بعد.",
    emptyBrief: "لا يوجد موجز استخباراتي بعد. سيتم إنشاؤه كل صباح.",
    noMatch: (q) => `لا توجد عناصر تطابق «${q}».`,
    items: (n) =>
      n === 1 ? "عنصر واحد" : n === 2 ? "عنصران" : n <= 10 ? `${n} عناصر` : `${n} عنصرًا`,
    errorTitle: "تعذّر تحميل الموجز",
    errorRls: "الجدول محمي بأمان مستوى الصفوف (RLS) والمفتاح العام غير مسموح له بالقراءة بعد. أضِف سياسة قراءة لدور <code>anon</code> (انظر ملف README الخاص بالمشروع).",
    errorGeneric: "حدثت مشكلة في الوصول إلى Supabase.",
    footer: "البيانات من Supabase · يُنشأ الموجز يوميًا",
    footerLink: "عرض معلومات الجدول",
    briefTitle: "الموجز الاستخباراتي اليومي",
    scoreGlobalRisk: "المخاطر العالمية",
    scoreMarketRisk: "مخاطر السوق",
    scoreAiCompetition: "المنافسة في الذكاء الاصطناعي",
    scoreBusinessOpportunity: "الفرص التجارية",
    recommendedFocus: "التركيز الموصى به",
    readFullBrief: "قراءة الموجز كاملاً",
  },
};

const LANG_KEY = "morning-lang";
function t(key, ...args) {
  const entry = I18N[state.lang][key];
  return typeof entry === "function" ? entry(...args) : entry;
}
function dateLocale() {
  return state.lang === "ar" ? "ar" : undefined;
}

// View definitions ---------------------------------------------------------
const VIEWS = {
  news: {
    table: "ai_news_digest",
    order: "created_at",
    emptyKey: "emptyNews",
    render: renderNewsCard,
    groupBy: (row) => dayKey(row.created_at),
  },
  models: {
    table: "ai_model_releases",
    // Sort by actual release date (undated entries last), not insertion time.
    order: "release_date",
    orderOpts: { ascending: false, nullsFirst: false },
    emptyKey: "emptyModels",
    render: renderModelCard,
    groupBy: (row) => dayKey(row.release_date || row.created_at),
  },
  brief: {
    table: "daily_intel_briefs",
    order: "report_date",
    orderOpts: { ascending: false },
    emptyKey: "emptyBrief",
    render: renderBriefCard,
    groupBy: (row) => dateOnlyKey(row.report_date),
  },
};

const TAB_LABEL_KEYS = { news: "tabNews", models: "tabModels", brief: "tabBrief" };

const state = {
  view: "news",
  rows: [],
  filter: "",
  lang: localStorage.getItem(LANG_KEY) === "ar" ? "ar" : "en",
};

// Elements -----------------------------------------------------------------
const els = {
  feed: document.getElementById("feed"),
  status: document.getElementById("status"),
  count: document.getElementById("count"),
  search: document.getElementById("search"),
  refresh: document.getElementById("refresh"),
  refreshLabel: document.getElementById("refresh-label"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  sourceLink: document.getElementById("source-link"),
  tagline: document.getElementById("tagline"),
  langToggle: document.getElementById("lang-toggle"),
  footerText: document.getElementById("footer-text"),
};

// Apply the current language to all static chrome, direction, and dates.
function applyLanguage() {
  const lang = state.lang;
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = I18N[lang].dir;
  els.tagline.textContent = t("tagline");
  els.tabs.forEach((tab) => {
    tab.textContent = t(TAB_LABEL_KEYS[tab.dataset.view]);
  });
  els.search.placeholder = t("searchPlaceholder");
  els.refreshLabel.textContent = t("refresh");
  els.refresh.title = t("refreshTitle");
  els.langToggle.textContent = t("langToggle");
  els.langToggle.title = t("langToggleTitle");
  els.footerText.innerHTML =
    `${escapeHtml(t("footer"))} · <a id="source-link" href="${escapeAttr(els.sourceLink.href)}" rel="noopener">${escapeHtml(t("footerLink"))}</a>`;
  els.sourceLink = document.getElementById("source-link");
}

// Link to the Supabase dashboard for this project (ref = first hostname label).
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
els.sourceLink.href = `https://supabase.com/dashboard/project/${projectRef}/editor`;

// Keep sticky day-labels below the real header height (it varies by viewport).
const headerEl = document.querySelector(".site-header");
function syncHeaderHeight() {
  document.documentElement.style.setProperty("--header-h", `${headerEl.offsetHeight}px`);
}
syncHeaderHeight();
window.addEventListener("resize", syncHeaderHeight);

// Events -------------------------------------------------------------------
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.view === state.view) return;
    els.tabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
    });
    state.view = tab.dataset.view;
    state.filter = "";
    els.search.value = "";
    load();
  });
});

els.search.addEventListener("input", () => {
  state.filter = els.search.value.trim().toLowerCase();
  paint();
});

els.refresh.addEventListener("click", load);

els.langToggle.addEventListener("click", () => {
  state.lang = state.lang === "ar" ? "en" : "ar";
  applyLanguage();
  paint();
});

// Data ---------------------------------------------------------------------
async function load() {
  const view = VIEWS[state.view];
  els.refresh.classList.add("is-loading");
  els.count.textContent = "";
  showSkeleton();

  const { data, error } = await supabase
    .from(view.table)
    .select("*")
    .order(view.order, view.orderOpts || { ascending: false })
    .limit(500);

  els.refresh.classList.remove("is-loading");

  if (error) {
    state.rows = [];
    showError(error);
    return;
  }

  state.rows = data || [];
  els.status.innerHTML = "";
  paint();
}

// Render -------------------------------------------------------------------
function paint() {
  const view = VIEWS[state.view];
  const rows = filterRows(state.rows, state.filter);

  els.count.textContent = rows.length ? t("items", rows.length) : "";

  if (!state.rows.length) {
    els.feed.innerHTML = "";
    showEmpty(t(view.emptyKey));
    return;
  }
  if (!rows.length) {
    els.feed.innerHTML = "";
    showEmpty(t("noMatch", escapeHtml(state.filter)));
    return;
  }
  els.status.innerHTML = "";

  // Group rows by day, preserving descending order.
  const groups = [];
  const index = new Map();
  for (const row of rows) {
    const key = view.groupBy(row);
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ key, rows: [] });
    }
    groups[index.get(key)].rows.push(row);
  }

  els.feed.innerHTML = groups
    .map(
      (g) => `
      <div class="day-group">
        <div class="day-label">${escapeHtml(dayLabel(g.key))}</div>
        ${g.rows.map(view.render).join("")}
      </div>`
    )
    .join("");
}

// Search only user-visible text fields — not ids or raw timestamps.
const HIDDEN_FIELDS = new Set(["id", "created_at"]);
function filterRows(rows, filter) {
  if (!filter) return rows;
  return rows.filter((row) =>
    Object.entries(row).some(
      ([k, v]) =>
        !HIDDEN_FIELDS.has(k) && v != null && String(v).toLowerCase().includes(filter)
    )
  );
}

// Summaries may be stored bilingually as "EN: <english> AR: <arabic>".
// Show the half matching the active language; plain summaries pass through.
function localizedSummary(summary) {
  if (!summary) return null;
  const m = summary.match(/^\s*EN:\s*([\s\S]*?)\s*AR:\s*([\s\S]*)$/);
  if (!m) return summary;
  const [, en, ar] = m;
  return (state.lang === "ar" ? ar : en).trim() || summary;
}

// Only link out to http(s) URLs — anything else renders as plain text.
function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

// Arabic-script detection so a single card's summary direction follows
// its actual text, independent of the page-wide language toggle.
const ARABIC_RE = /[؀-ۿ]/;
function summaryHtml(rawSummary) {
  const text = localizedSummary(rawSummary);
  if (!text) return "";
  const dir = ARABIC_RE.test(text) ? "rtl" : "ltr";
  return `<p class="card-summary" dir="${dir}">${escapeHtml(text)}</p>`;
}

function renderNewsCard(row) {
  const href = row.url && safeUrl(row.url);
  const title = href
    ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.title)}</a>`
    : escapeHtml(row.title);
  return `
    <article class="card">
      <h3 class="card-title">${title}</h3>
      ${summaryHtml(row.summary)}
      <div class="card-meta">
        ${row.source ? `<span class="badge">${escapeHtml(row.source)}</span>` : ""}
        <span>${escapeHtml(timeLabel(row.created_at))}</span>
      </div>
    </article>`;
}

function renderModelCard(row) {
  const name = [row.model, row.version].filter(Boolean).join(" ");
  const href = row.url && safeUrl(row.url);
  const title = href
    ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`
    : escapeHtml(name);
  return `
    <article class="card">
      <h3 class="card-title">${title}</h3>
      ${summaryHtml(row.summary)}
      <div class="card-meta">
        ${row.vendor ? `<span class="badge">${escapeHtml(row.vendor)}</span>` : ""}
        ${row.source ? `<span class="badge neutral">${escapeHtml(row.source)}</span>` : ""}
        ${row.release_date ? `<span>${escapeHtml(dayLabel(dayKey(row.release_date)))}</span>` : ""}
      </div>
    </article>`;
}

// Scoreboard ----------------------------------------------------------------
// Risk-type scores: 0 = good (green), 10 = bad (red). Opportunity-type
// scores invert that (0 = bad, 10 = good).
const SCORE_FIELDS = [
  { key: "global_risk", labelKey: "scoreGlobalRisk", invert: false },
  { key: "market_risk", labelKey: "scoreMarketRisk", invert: false },
  { key: "ai_competition", labelKey: "scoreAiCompetition", invert: false },
  { key: "business_opportunity", labelKey: "scoreBusinessOpportunity", invert: true },
];

function scoreLevel(value, invert) {
  const v = invert ? 10 - value : value;
  if (v <= 3) return "low";
  if (v <= 6) return "mid";
  return "high";
}

function scoreboardHtml(row) {
  const chips = SCORE_FIELDS.filter((f) => row[f.key] != null)
    .map((f) => {
      const value = row[f.key];
      const level = scoreLevel(value, f.invert);
      return `
        <div class="score-chip score-${level}">
          <span class="score-value">${escapeHtml(value)}</span>
          <span class="score-label">${escapeHtml(t(f.labelKey))}</span>
        </div>`;
    })
    .join("");
  return chips ? `<div class="scoreboard">${chips}</div>` : "";
}

// Markdown rendering — sanitized with DOMPurify (defense in depth; the
// content originates from our own pipeline, but is still untrusted database
// content by the time it reaches the browser, same as every other field).
function renderMarkdown(md) {
  if (!md) return "";
  const rawHtml = marked.parse(md, { breaks: true });
  return DOMPurify.sanitize(rawHtml, { ADD_ATTR: ["target"] });
}

function renderBriefCard(row) {
  const isLatest = row.report_date === state.rows[0]?.report_date;
  const focusHtml = row.recommended_focus
    ? `<p class="brief-focus"><strong>${escapeHtml(t("recommendedFocus"))}:</strong> ${escapeHtml(row.recommended_focus)}</p>`
    : "";
  return `
    <article class="card brief-card">
      <h3 class="card-title">${escapeHtml(t("briefTitle"))}</h3>
      ${scoreboardHtml(row)}
      ${focusHtml}
      <details class="brief-details"${isLatest ? " open" : ""}>
        <summary>${escapeHtml(t("readFullBrief"))}</summary>
        <div class="brief-body">${renderMarkdown(row.content_md)}</div>
      </details>
    </article>`;
}

// States -------------------------------------------------------------------
function showSkeleton() {
  els.feed.innerHTML =
    `<div class="skeleton">` +
    Array.from({ length: 4 })
      .map(
        () => `
      <article class="card">
        <div class="sk-line" style="width:70%"></div>
        <div class="sk-line" style="width:100%"></div>
        <div class="sk-line" style="width:85%"></div>
        <div class="sk-line" style="width:30%;margin-top:14px"></div>
      </article>`
      )
      .join("") +
    `</div>`;
}

function showEmpty(message) {
  els.status.innerHTML = `
    <div class="state">
      <h2>${escapeHtml(t("nothingTitle"))}</h2>
      <p>${message}</p>
    </div>`;
}

function showError(error) {
  const rls =
    error.code === "42501" ||
    /permission denied|row-level security|RLS/i.test(error.message || "");
  els.feed.innerHTML = "";
  els.status.innerHTML = `
    <div class="state error">
      <h2>${escapeHtml(t("errorTitle"))}</h2>
      <p>${rls ? t("errorRls") : escapeHtml(t("errorGeneric"))}</p>
      <pre>${escapeHtml(error.message || String(error))}</pre>
    </div>`;
}

// Helpers ------------------------------------------------------------------
function dayKey(value) {
  if (!value) return "unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Parse a plain SQL `date` string ("YYYY-MM-DD", no time/zone) into the same
// key format dayKey() produces, using LOCAL y/m/d construction. Avoids the
// classic off-by-one-day bug from `new Date("YYYY-MM-DD")`, which ECMA-262
// parses as UTC midnight — comparing that against local getFullYear/getMonth/
// getDate() shifts the date back a day in any negative-UTC-offset timezone.
function dateOnlyKey(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!m) return dayKey(value);
  const [, y, mo, d] = m;
  return `${Number(y)}-${Number(mo) - 1}-${Number(d)}`;
}

function dayLabel(key) {
  if (key === "unknown") return t("undated");
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m, d);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return t("today");
  if (sameDay(date, yest)) return t("yesterday");
  return date.toLocaleDateString(dateLocale(), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function timeLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

// Go -----------------------------------------------------------------------
applyLanguage();
load();
