import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// View definitions ---------------------------------------------------------
const VIEWS = {
  news: {
    table: "ai_news_digest",
    order: "created_at",
    empty: "No news items yet. The daily digest will populate this table each morning.",
    render: renderNewsCard,
    groupBy: (row) => dayKey(row.created_at),
  },
  models: {
    table: "ai_model_releases",
    order: "created_at",
    empty: "No model releases recorded yet.",
    render: renderModelCard,
    groupBy: (row) => dayKey(row.release_date || row.created_at),
  },
};

const state = {
  view: "news",
  rows: [],
  filter: "",
};

// Elements -----------------------------------------------------------------
const els = {
  feed: document.getElementById("feed"),
  status: document.getElementById("status"),
  count: document.getElementById("count"),
  search: document.getElementById("search"),
  refresh: document.getElementById("refresh"),
  tabs: Array.from(document.querySelectorAll(".tab")),
  sourceLink: document.getElementById("source-link"),
};

els.sourceLink.href = `${SUPABASE_URL}/project/default/editor`;

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

// Data ---------------------------------------------------------------------
async function load() {
  const view = VIEWS[state.view];
  els.refresh.classList.add("is-loading");
  els.count.textContent = "";
  showSkeleton();

  const { data, error } = await supabase
    .from(view.table)
    .select("*")
    .order(view.order, { ascending: false })
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

  els.count.textContent = rows.length
    ? `${rows.length} item${rows.length === 1 ? "" : "s"}`
    : "";

  if (!state.rows.length) {
    els.feed.innerHTML = "";
    showEmpty(view.empty);
    return;
  }
  if (!rows.length) {
    els.feed.innerHTML = "";
    showEmpty(`No items match “${escapeHtml(state.filter)}”.`);
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

function filterRows(rows, filter) {
  if (!filter) return rows;
  return rows.filter((row) =>
    Object.values(row).some(
      (v) => v != null && String(v).toLowerCase().includes(filter)
    )
  );
}

function renderNewsCard(row) {
  const title = row.url
    ? `<a href="${escapeAttr(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.title)}</a>`
    : escapeHtml(row.title);
  return `
    <article class="card">
      <h3 class="card-title">${title}</h3>
      ${row.summary ? `<p class="card-summary">${escapeHtml(row.summary)}</p>` : ""}
      <div class="card-meta">
        ${row.source ? `<span class="badge">${escapeHtml(row.source)}</span>` : ""}
        <span>${escapeHtml(timeLabel(row.created_at))}</span>
      </div>
    </article>`;
}

function renderModelCard(row) {
  const name = [row.model, row.version].filter(Boolean).join(" ");
  const title = row.url
    ? `<a href="${escapeAttr(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)}</a>`
    : escapeHtml(name);
  return `
    <article class="card">
      <h3 class="card-title">${title}</h3>
      ${row.summary ? `<p class="card-summary">${escapeHtml(row.summary)}</p>` : ""}
      <div class="card-meta">
        ${row.vendor ? `<span class="badge">${escapeHtml(row.vendor)}</span>` : ""}
        ${row.source ? `<span class="badge neutral">${escapeHtml(row.source)}</span>` : ""}
        ${row.release_date ? `<span>${escapeHtml(dayLabel(dayKey(row.release_date)))}</span>` : ""}
      </div>
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
      <h2>Nothing to show</h2>
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
      <h2>Couldn’t load the digest</h2>
      <p>${
        rls
          ? "The table is protected by Row Level Security and the public key isn’t allowed to read it yet. Add a read policy for the <code>anon</code> role (see the project README)."
          : "There was a problem reaching Supabase."
      }</p>
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

function dayLabel(key) {
  if (key === "unknown") return "Undated";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m, d);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yest)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
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
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
load();
