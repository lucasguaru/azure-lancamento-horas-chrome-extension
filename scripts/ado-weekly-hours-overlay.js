(() => {
  const WIDGET_ID      = "__lh_weekly_widget_btn__";
  const MODAL_ID       = "__lh_weekly_widget_modal__";
  const LS_PREFIX      = "__lh_weekly_v2_";
  const LS_WEEKENDS    = "__lh_show_weekends__";
  const LS_DATE_COLS   = "__lh_show_date_cols__";
  const LS_HIERARCHY   = "__lh_group_hierarchy__";
  const LS_LH_ACTIONS  = "__lh_show_lh_actions__";
  const LS_VIEW_MODE   = "__lh_view_mode__";
  const LS_RANGE_START = "__lh_range_start__";
  const LS_RANGE_END   = "__lh_range_end__";
  const KEY_OPEN_MODAL = "F2";
  const BUILD_VERSION  = __BUILD_VERSION__;
  let holidayNameByYmd = null; // { [YYYY-MM-DD]: string }
  function ensureHolidaysLoaded() {
    if (holidayNameByYmd) return holidayNameByYmd;
    holidayNameByYmd = {};
    try {
      const arr = __BR_NATIONAL_HOLIDAYS_2026_2030__;
      if (Array.isArray(arr)) {
        for (const it of arr) {
          const d = String(it?.date || "").trim();
          const n = String(it?.name || "").trim();
          if (!d || !n) continue;
          holidayNameByYmd[d] = n;
        }
      }
    } catch {}
    return holidayNameByYmd;
  }

  if (document.getElementById(WIDGET_ID)) document.getElementById(WIDGET_ID).remove();
  if (document.getElementById(MODAL_ID))  document.getElementById(MODAL_ID).remove();

  // ── CSS (inject once) ──────────────────────────────────────────────────────
  if (!document.getElementById("__lh_styles__")) {
    const s = document.createElement("style");
    s.id = "__lh_styles__";
    s.textContent = `
      @keyframes __lh_spin { to { transform: rotate(360deg); } }
      .lh-pill {
        display:inline-flex; align-items:center; gap:6px;
        padding:2px 8px; border-radius:999px; font-weight:700; font-size:11px;
        border:1px solid transparent;
      }
      .lh-pill--ok { background:#f0fdf4; color:#166534; border-color:#bbf7d0; }
      .lh-pill--warn { background:#fef2f2; color:#b91c1c; border-color:#fecaca; }
      .lh-pill--muted { background:#f8fafc; color:#64748b; border-color:#e2e8f0; font-weight:600; }
      .lh-tooltip-wrap { position:relative; display:inline-flex; align-items:center; }
      .lh-tooltip {
        position:absolute; z-index:2147483647;
        top:calc(100% + 8px); left:50%; transform:translateX(-50%);
        min-width:260px; max-width:520px;
        background:#0b1220; color:#e2e8f0;
        border:1px solid rgba(148,163,184,0.25);
        border-radius:12px; padding:10px 12px;
        box-shadow:0 16px 40px rgba(0,0,0,0.35);
        opacity:0; pointer-events:none;
        transition:opacity .12s ease, transform .12s ease;
      }
      .lh-tooltip-wrap:hover .lh-tooltip {
        opacity:1; pointer-events:auto;
        transform:translateX(-50%) translateY(0);
      }
      .lh-tooltip h4 { margin:0 0 8px 0; font-size:12px; color:#f8fafc; letter-spacing:.2px; }
      .lh-tooltip .lh-tip-sub { font-size:11px; color:#94a3b8; margin:0 0 8px 0; }
      .lh-tooltip table { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; }
      .lh-tooltip th, .lh-tooltip td { font-size:11px; padding:6px 8px; border-top:1px solid rgba(148,163,184,0.18); }
      .lh-tooltip th { text-align:center; color:#cbd5e1; font-weight:700; }
      .lh-tooltip td { text-align:center; color:#e2e8f0; font-variant-numeric:tabular-nums; }
      .lh-tooltip .lh-tip-k { text-align:left; color:#cbd5e1; font-weight:700; white-space:nowrap; }
      .lh-edit-input {
        width:100%; box-sizing:border-box; text-align:center;
        border:1px solid #cbd5e1; border-radius:4px; padding:2px 4px;
        font-size:12px; background:#fff; -moz-appearance:textfield;
      }
      .lh-edit-input::-webkit-outer-spin-button,
      .lh-edit-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .lh-edit-input:focus { outline:2px solid #0078d4; border-color:#0078d4; }
      .lh-cell-changed { background:#fef3c7 !important; }
      .lh-cell-changed .lh-edit-input { border-color:#f59e0b !important; background:#fffbeb !important; }
    `;
    document.head.appendChild(s);
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  const pad2  = (n) => String(n).padStart(2, "0");
  const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function isValidYmd(ymd) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""));
  }

  function parseLocalDateYmd(ymd) {
    if (!isValidYmd(ymd)) return null;
    const d = new Date(ymd + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function diffDaysInclusive(startYmd, endYmd) {
    const a = parseLocalDateYmd(startYmd);
    const b = parseLocalDateYmd(endYmd);
    if (!a || !b) return null;
    const ms = b.getTime() - a.getTime();
    const days = Math.floor(ms / 86400000);
    return days >= 0 ? (days + 1) : null;
  }

  function addDays(d, days) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  }

  function startOfIsoWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function allDayDatesFromYmd(weekStartYmd) {
    const start = new Date(weekStartYmd + "T00:00:00");
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }

  function allDayDatesFromRangeYmd(startYmd, endYmd) {
    const start = new Date(startYmd + "T00:00:00");
    const end = new Date(endYmd + "T00:00:00");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return Array.from({ length: days }, (_, i) => addDays(start, i));
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const WDAYS  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];
  function formatDdMmm(d) { return `${pad2(d.getDate())}-${MONTHS[d.getMonth()]}`; }

  function normalizeCommentText(text) {
    if (!text) return "";
    return text
      .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&nbsp;/g," ")
      .trim();
  }

  function parseLHLine(line) {
    const t = line.trim();
    if (!t.startsWith("LH|")) return null;
    const obj = {};
    t.slice(3).split("|").forEach(p => { const i = p.indexOf("="); if (i>0) obj[p.slice(0,i)] = p.slice(i+1); });
    if (!obj.work_date || obj.hours == null) return null;
    const h = Number(String(obj.hours).replace(",","."));
    return Number.isFinite(h) ? { workDate: obj.work_date, hours: h } : null;
  }

  function parseLHTracker(commentText) {
    const plain = normalizeCommentText(commentText);
    if (!plain.startsWith("LH|")) return null;
    return plain.split(/\r?\n/).map(parseLHLine).filter(Boolean);
  }

  function getLHTrackerComments(comments) {
    return (comments || []).filter(c => normalizeCommentText(c?.text).startsWith("LH|"));
  }

  function getLatestLHTrackerComment(comments) {
    const trackers = getLHTrackerComments(comments);
    if (trackers.length === 0) return null;
    const sorted = trackers.slice().sort((a, b) => {
      const ad = Date.parse(String(a?.createdDate || ""));
      const bd = Date.parse(String(b?.createdDate || ""));
      if (Number.isFinite(ad) && Number.isFinite(bd) && ad !== bd) return bd - ad;
      const ai = Number(a?.id || 0);
      const bi = Number(b?.id || 0);
      return bi - ai;
    });
    return sorted[0] || null;
  }

  // Consolida múltiplos comentários LH| antigos:
  // para cada work_date, mantém o valor mais recente e preserva datas ausentes em comentários anteriores.
  function collectLHEntriesFromComments(comments) {
    const trackers = getLHTrackerComments(comments).slice().sort((a, b) => {
      const ad = Date.parse(String(a?.createdDate || ""));
      const bd = Date.parse(String(b?.createdDate || ""));
      if (Number.isFinite(ad) && Number.isFinite(bd) && ad !== bd) return bd - ad;
      const ai = Number(a?.id || 0);
      const bi = Number(b?.id || 0);
      return bi - ai;
    });
    const byDate = new Map();
    for (const t of trackers) {
      const entries = parseLHTracker(t?.text) || [];
      for (const e of entries) {
        if (!e?.workDate || byDate.has(e.workDate)) continue;
        byDate.set(e.workDate, { workDate: e.workDate, hours: round2(Math.max(0, Number(e.hours) || 0)) });
      }
    }
    return [...byDate.values()].sort((a, b) => a.workDate.localeCompare(b.workDate));
  }

  function parseOrgProject() {
    const parts = location.pathname.split("/").filter(Boolean);
    const org = decodeURIComponent(parts[0] || "");
    const projectFromPath = decodeURIComponent(parts[1] || "");
    const projectFromQuery =
      new URLSearchParams(location.search).get("project")
      || new URLSearchParams(location.search).get("projectName")
      || "";
    const projectFromVss =
      window.__vssPageContext?.webContext?.project?.name
      || window.__vssPageContext?.webContext?.project?.id
      || "";
    const candidates = [projectFromPath, projectFromQuery, projectFromVss]
      .map((x) => decodeURIComponent(String(x || "").trim()))
      .filter(Boolean);
    const project = candidates.find((x) => !x.startsWith("_"));

    if (location.hostname !== "dev.azure.com" || !org || !project)
      throw new Error("Abra no domínio dev.azure.com/{org}/{project}.");
    return { org, project };
  }

  const { org: ORG, project: PROJECT } = parseOrgProject();
  const ADO_BASE = `https://dev.azure.com/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}/_apis`;

  function workItemUrl(id) {
    return `https://dev.azure.com/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}/_workitems/edit/${id}`;
  }

  function newTaskUrlWithParent(parentId) {
    const base = `https://dev.azure.com/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}/_workitems/create/Task`;
    const qs = new URLSearchParams();
    qs.set("[System.AssignedTo]", "@Me");
    // Parent será anexado na própria UI de create pelo script ado-autoparent-create.js
    if (parentId != null) qs.set("lh_parent", String(parentId));
    return `${base}?${qs.toString()}`;
  }

  async function adoFetchJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        // Evita redirect silencioso para /_signin em chamadas REST do ADO.
        "X-TFS-FedAuthRedirect": "Suppress",
        ...(options.headers || {})
      },
      ...options
    });
    if (res.redirected && /\/_signin/i.test(String(res.url || ""))) {
      throw new Error("Sessão do Azure DevOps expirada. Recarregue a página e autentique novamente.");
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} — ${url}\n${t.slice(0, 300)}`);
    }
    return res.status === 204 ? {} : res.json();
  }

  const fmt = (n) => {
    if (!n) return "";
    return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  };
  const round2 = (n) => Number((Number(n) || 0).toFixed(2));
  const parseHoursMaybe = (v) => {
    if (v == null || v === "") return null;
    const n = Number(String(v ?? "0").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const parseHours = (v) => parseHoursMaybe(v) ?? 0;
  const toYmdOrNull = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : toYmd(d);
  };
  const ymdToIsoAtLocalTime = (ymd, time) => new Date(`${ymd}T${time}`).toISOString();

  // ── localStorage ───────────────────────────────────────────────────────────
  function lsKey(mode, periodStartYmd, periodEndShownYmd) {
    const s = String(periodStartYmd || "");
    const e = String(periodEndShownYmd || "");
    return `${LS_PREFIX}${mode}__${s}__${e}`;
  }

  function lsSave(data) {
    try {
      localStorage.setItem(lsKey(data.viewMode, data.periodStartYmd, data.periodEndShownYmd), JSON.stringify({
        viewMode: data.viewMode,
        periodStartYmd: data.periodStartYmd,
        periodEndShownYmd: data.periodEndShownYmd,
        rows: data.rows,
        ts: Date.now()
      }));
    } catch {}
  }

  function lsLoad(mode, periodStartYmd, periodEndShownYmd) {
    try {
      const raw = localStorage.getItem(lsKey(mode, periodStartYmd, periodEndShownYmd));
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (p.viewMode !== mode) return null;
      return { ...p, allDayDates: allDayDatesForPeriod(p.periodStartYmd, p.periodEndShownYmd, p.viewMode) };
    } catch { return null; }
  }

  function weekStartYmdForOffset(offset) {
    return toYmd(addDays(startOfIsoWeek(new Date()), offset * 7));
  }

  function monthStartYmdForOffset(offset) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return toYmd(d);
  }

  function allDayDatesForPeriod(periodStartYmd, periodEndShownYmd, mode) {
    if (mode === "range") {
      return allDayDatesFromRangeYmd(periodStartYmd, periodEndShownYmd);
    }
    const start = new Date(periodStartYmd + "T00:00:00");
    if (mode === "month") {
      const dates = [];
      const cursor = new Date(start);
      while (cursor.getMonth() === start.getMonth()) {
        dates.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      return dates;
    }
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }

  function periodStartYmdForOffset(offset, mode) {
    return mode === "month" ? monthStartYmdForOffset(offset) : weekStartYmdForOffset(offset);
  }

  // ── module state ───────────────────────────────────────────────────────────
  let periodOffset = 0;
  let viewMode = (() => {
    try {
      const v = localStorage.getItem(LS_VIEW_MODE);
      return v === "month" ? "month" : v === "range" ? "range" : "week";
    } catch {
      return "week";
    }
  })();
  let rangeStartYmd = (() => { try { return localStorage.getItem(LS_RANGE_START) || ""; } catch { return ""; } })();
  let rangeEndYmd = (() => { try { return localStorage.getItem(LS_RANGE_END) || ""; } catch { return ""; } })();
  const MAX_RANGE_DAYS = 62;
  let showWeekends = (() => { try { return localStorage.getItem(LS_WEEKENDS) === "1"; } catch { return false; } })();
  let showDateCols = (() => { try { return localStorage.getItem(LS_DATE_COLS) === "1"; } catch { return false; } })();
  let showLhActions = (() => {
    try {
      const v = localStorage.getItem(LS_LH_ACTIONS);
      return v == null ? true : v === "1";
    } catch {
      return true;
    }
  })();
  let groupByHierarchy = (() => {
    try {
      const v = localStorage.getItem(LS_HIERARCHY);
      return v == null ? true : v === "1";
    } catch {
      return true;
    }
  })();
  let editMode     = false;
  let pendingEdits = new Map();  // `${taskId}__${dayKey}` → number
  let editBaseData = null;       // snapshot de rows ao entrar no modo edição

  function persistRange() {
    try { localStorage.setItem(LS_RANGE_START, String(rangeStartYmd || "")); } catch {}
    try { localStorage.setItem(LS_RANGE_END, String(rangeEndYmd || "")); } catch {}
  }

  function getEffectiveRangeForOffset(offset) {
    const days = diffDaysInclusive(rangeStartYmd, rangeEndYmd);
    if (!days) return null;
    const start = parseLocalDateYmd(rangeStartYmd);
    const end = parseLocalDateYmd(rangeEndYmd);
    if (!start || !end) return null;
    const shift = offset * days;
    const effStart = addDays(start, shift);
    const effEnd = addDays(end, shift);
    return { startYmd: toYmd(effStart), endYmd: toYmd(effEnd), days };
  }

  function getPeriodInfoForOffset(offset, mode) {
    if (mode === "range") {
      const r = getEffectiveRangeForOffset(offset);
      if (!r) return null;
      const allDayDates = allDayDatesFromRangeYmd(r.startYmd, r.endYmd);
      const periodStart = new Date(r.startYmd + "T00:00:00");
      const periodEndExclusive = addDays(new Date(r.endYmd + "T00:00:00"), 1);
      return {
        periodStartYmd: r.startYmd,
        periodEndShownYmd: r.endYmd,
        periodStart,
        periodEndExclusive,
        allDayDates,
        rangeDays: r.days
      };
    }

    const periodStartYmd = periodStartYmdForOffset(offset, mode);
    const periodStart = new Date(periodStartYmd + "T00:00:00");
    const periodEndExclusive = mode === "month"
      ? new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 1)
      : addDays(periodStart, 7);
    const allDayDates = allDayDatesForPeriod(periodStartYmd, toYmd(addDays(periodEndExclusive, -1)), mode);
    const periodEndShownYmd = toYmd(addDays(periodEndExclusive, -1));
    return { periodStartYmd, periodEndShownYmd, periodStart, periodEndExclusive, allDayDates };
  }

  // ── CSS helpers ────────────────────────────────────────────────────────────
  const btnCss    = () => "padding:5px 11px; border:1px solid #ccc; background:#f7f7f7; border-radius:7px; cursor:pointer; font-size:12px;";
  const navBtnCss = () => "padding:5px 12px; border:1px solid #0078d4; background:#fff; color:#0078d4; border-radius:7px; cursor:pointer; font-size:12px;";
  const acBtnCss  = (color) => `padding:5px 12px; border:1px solid ${color}; background:${color}; color:#fff; border-radius:7px; cursor:pointer; font-size:12px; font-weight:600;`;
  const spinnerCss = "display:inline-block; width:15px; height:15px; border:2px solid #0078d4; border-top-color:transparent;" +
                     "border-radius:50%; animation:__lh_spin 0.7s linear infinite; vertical-align:middle; flex-shrink:0;";

  // ── modal HTML ─────────────────────────────────────────────────────────────
  function modalHtml() {
    return `
<div id="${MODAL_ID}" style="
  position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:2147483646;
  display:flex; align-items:center; justify-content:center;
  font-family:Segoe UI,Arial,sans-serif; font-size:13px;">
  <div style="
    width:max-content; max-width:100vw; max-height:90vh; display:flex; flex-direction:column;
    background:#fff; border-radius:12px;
    box-shadow:0 20px 60px rgba(0,0,0,.35); border:1px solid #ddd; overflow:hidden;">

    <!-- header -->
    <div style="display:flex; align-items:center; justify-content:space-between;
                padding:10px 16px; border-bottom:1px solid #eee; flex-shrink:0;">
      <span style="font-weight:700; font-size:14px;">
        Hours Overlay (LH + Revisões)
        <span style="font-weight:500; color:#64748b; font-size:11px;">build ${BUILD_VERSION}</span>
      </span>
      <div style="display:flex; gap:8px; align-items:center;">
        <span id="lh-save-spinner" style="${spinnerCss} display:none;"></span>
        <button id="lh-edit-btn"    style="${acBtnCss("#6366f1")}">✏️ Editar</button>
        <button id="lh-cancel-btn"  style="${btnCss()} display:none;">✕ Cancelar</button>
        <button id="lh-save-btn"    style="${acBtnCss("#16a34a")} display:none;">💾 Salvar</button>
        <button id="lh-refresh-btn" style="${btnCss()}">⟳ Atualizar</button>
        <button id="lh-close-btn"   style="${btnCss()}">✕ Fechar</button>
      </div>
    </div>

    <!-- week navigator + modo (linha 1); toggles (linha 2) -->
    <div style="flex-shrink:0; background:#fafafa; border-bottom:1px solid #eee;">
      <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:8px 16px 6px; width:100%; box-sizing:border-box;">
        <div style="display:flex; align-items:center; gap:8px; flex:0 1 auto; max-width:100%; min-width:0;">
          <button id="lh-prev-btn" style="${navBtnCss()} flex-shrink:0;">&#8249; Anterior</button>
          <div id="lh-center-slot" style="flex:0 1 auto; min-width:0; max-width:100%; display:flex; justify-content:flex-start; align-items:center;">
            <span id="lh-week-label" style="font-weight:600; text-align:left; word-break:break-word;"></span>
            <div id="lh-range-inline" style="display:none; flex-direction:column; align-items:flex-start; gap:3px; max-width:100%;">
              <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-start;">
                <input id="lh-range-start" type="date" style="padding:4px 6px; border:1px solid #cbd5e1; border-radius:7px; font-size:12px; background:#fff; max-width:100%; box-sizing:border-box;" />
                <span style="color:#64748b; font-size:12px;">→</span>
                <input id="lh-range-end" type="date" style="padding:4px 6px; border:1px solid #cbd5e1; border-radius:7px; font-size:12px; background:#fff; max-width:100%; box-sizing:border-box;" />
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
            <button id="lh-next-btn" style="${navBtnCss()}">Próxima &#8250;</button>
            <span id="lh-spinner" style="${spinnerCss} display:none;"></span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; flex:0 0 auto; margin-left:auto;">
          <button id="lh-mode-week" style="${btnCss()}">Semanal</button>
          <button id="lh-mode-month" style="${btnCss()}">Mensal</button>
          <button id="lh-mode-range" style="${btnCss()}">Período</button>
        </div>
      </div>
      <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; padding:0 16px 8px;">
        <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-size:12px;">
          <input type="checkbox" id="lh-hierarchy-toggle" style="cursor:pointer;" />
          Agrupar por hierarquia
        </label>
        <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-size:12px;">
          <input type="checkbox" id="lh-date-cols-toggle" style="cursor:pointer;" />
          Mostrar Start/Finish
        </label>
        <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-size:12px;">
          <input type="checkbox" id="lh-lh-actions-toggle" style="cursor:pointer;" />
          <span style="display:inline-flex; align-items:center; gap:4px;">
            Mostrar LH/Ações
            <span id="lh-lh-actions-alert" style="display:none; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; border-radius:999px; padding:0 6px; font-size:11px; line-height:16px;">⚠</span>
          </span>
        </label>
        <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-size:12px;">
          <input type="checkbox" id="lh-weekend-toggle" style="cursor:pointer;" />
          <span style="display:inline-flex; align-items:center; gap:4px;">
            Mostrar fim de semana
            <span id="lh-weekend-alert" style="display:none; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; border-radius:999px; padding:0 6px; font-size:11px; line-height:16px;">⚠</span>
          </span>
        </label>
      </div>
    </div>

    <!-- meta -->
    <div id="lh-meta" style="padding:4px 16px; color:#888; font-size:11px; flex-shrink:0; min-height:20px;"></div>

    <!-- content (scrollable) -->
    <div id="lh-content" style="padding:0 16px 16px; overflow:auto; flex:1;"></div>
  </div>
</div>`;
  }

  // ── table render ───────────────────────────────────────────────────────────
  function renderTable({ rows, allDayDates }, totalsCallback, onFixRow, onStatusAction, onSyncCompletedWork) {
    const visibleDates = showWeekends
      ? allDayDates
      : allDayDates.filter(d => d.getDay() !== 0 && d.getDay() !== 6);
    const visibleKeys = visibleDates.map(toYmd);
    const visibleHdrs = visibleDates.map(formatDdMmm);
    const holidayByKey = holidayNameByYmd || {};

    function buildMissingTrackerHint(r) {
      const daysWithHours = visibleKeys
        .map((k) => ({ k, h: Number(r.byDay?.[k] || 0) }))
        .filter(x => x.h > 1e-9);

      const cols = ["", "Completed Work", ...daysWithHours.map(x => x.k)];
      const cw = Number(r.completedWork || 0);

      const headerHtml = cols.map(c => `<th>${escapeHtml(c)}</th>`).join("");
      const rowHtml = [
        `<td>${escapeHtml(fmt(cw))}h</td>`,
        ...daysWithHours.map(x => `<td>${escapeHtml(fmt(x.h))}h</td>`)
      ].join("");

      const noDaysInView = daysWithHours.length === 0;
      const sub = noDaysInView
        ? "Há lançamentos no histórico, mas fora do período visível."
        : "Prévia de como o lançamento por dia ficaria (valor final do dia).";

      const tooltip = `
        <div class="lh-tooltip">
          <h4>Sem comentário LH| (com lançamentos)</h4>
          <div class="lh-tip-sub">${escapeHtml(sub)}</div>
          <table>
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>
              <tr><td class="lh-tip-k">Final</td>${rowHtml}</tr>
            </tbody>
          </table>
        </div>
      `;

      return `
        <span class="lh-tooltip-wrap">
          <span class="lh-pill lh-pill--warn">Sem LH</span>
          ${tooltip}
        </span>
      `;
    }

    function computeVisibleHoursForRow(row) {
      return round2(visibleKeys.reduce((sum, k) => {
        const pk = `${row.id}__${k}`;
        const val = editMode && pendingEdits.has(pk) ? pendingEdits.get(pk) : (row.byDay?.[k] || 0);
        return sum + Number(val || 0);
      }, 0));
    }

    function computeVisibleHoursTotalFromTotals(totals) {
      return round2(visibleKeys.reduce((sum, k) => sum + Number(totals?.[k] || 0), 0));
    }

    // Calcula totais considerando pendingEdits em modo edição
    function computeTotals() {
      const totals = Object.fromEntries(visibleKeys.map(k => [k, 0]));
      for (const r of rows) {
        visibleKeys.forEach(k => {
          const pk = `${r.id}__${k}`;
          const val = editMode && pendingEdits.has(pk) ? pendingEdits.get(pk) : (r.byDay[k] || 0);
          totals[k] += val;
        });
      }
      return totals;
    }

    function computeCompletedWorkTotal() {
      const deltaByTask = new Map();
      if (editMode && pendingEdits.size > 0) {
        for (const [pk, newVal] of pendingEdits.entries()) {
          const [idStr, dayKey] = pk.split("__");
          const taskId = Number(idStr);
          const row = rows.find(x => x.id === taskId);
          if (!row) continue;
          const origVal = Number(row.byDay?.[dayKey] || 0);
          const diff = Number(newVal) - origVal;
          if (Math.abs(diff) <= 1e-9) continue;
          deltaByTask.set(taskId, (deltaByTask.get(taskId) || 0) + diff);
        }
      }

      return round2(rows.reduce((sum, r) => {
        const base = parseHours(r.completedWork);
        const delta = deltaByTask.get(r.id) || 0;
        return sum + base + delta;
      }, 0));
    }

    const table = document.createElement("table");
    table.style.cssText = "width:100%; border-collapse:collapse; font-size:12px;";

    // thead
    const thead = document.createElement("thead");
    const htr   = document.createElement("tr");
    [
      { label: "ID",     align: "center", width: "52px"  },
      { label: "Title",  align: "left",   width: "140px" },
      { label: "Status", align: "center", width: "120px"  },
      { label: "Visible Hours in Period<br>/ Completed Work", align: "center", width: "90px" },
      ...(showDateCols ? [
        { label: "Start Date", align: "center", width: "92px" },
        { label: "Finish Date", align: "center", width: "92px" },
      ] : []),
      ...(showLhActions ? [
        { label: "LH", align: "center", width: "68px" },
        { label: "Ações", align: "center", width: "110px" },
      ] : []),
      ...visibleDates.map((d, i) => ({
        label: visibleHdrs[i], sub: WDAYS[d.getDay()],
        align: "center", width: "60px",
        weekend: d.getDay() === 0 || d.getDay() === 6,
        holiday: holidayByKey[toYmd(d)] || null
      }))
    ].forEach(col => {
      const th = document.createElement("th");
      th.innerHTML = col.sub
        ? `${col.label}<br><span style="font-weight:400;color:#888;">${col.sub}</span>`
        : col.label;
      if (col.holiday) th.title = col.holiday;
      th.style.cssText = `position:sticky; top:0; background:${col.holiday ? "#fff1f2" : col.weekend ? "#fdf6e3" : "#f3f4f6"};
        border:1px solid #ddd; padding:5px 7px; text-align:${col.align}; white-space:nowrap;
        ${col.width ? `width:${col.width};` : ""}`;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    // tbody
    const tbody  = document.createElement("tbody");
    const tdBase = "border:1px solid #ddd; padding:5px 7px;";

    const fixedColumns = 4 + (showDateCols ? 2 : 0) + (showLhActions ? 2 : 0);
    const totalColumns = fixedColumns + visibleKeys.length;
    const sortedRows = groupByHierarchy
      ? rows.slice().sort((a, b) => {
          const ga = String(a?.hierarchy?.groupKey || "");
          const gb = String(b?.hierarchy?.groupKey || "");
          const cmp = ga.localeCompare(gb, "pt-BR", { sensitivity: "base" });
          return cmp !== 0 ? cmp : (a.id - b.id);
        })
      : rows.slice().sort((a, b) => a.id - b.id);
    let lastGroupKey = null;

    sortedRows.forEach((r, ri) => {
      const groupKey = String(r?.hierarchy?.groupKey || "Sem Épico > Sem Feature > Sem PBI");
      if (groupByHierarchy && groupKey !== lastGroupKey) {
        const trGroup = document.createElement("tr");
        trGroup.style.background = "#f8fafc";

        const tdGroup = document.createElement("td");
        tdGroup.colSpan = totalColumns;
        tdGroup.style.cssText = `${tdBase} font-weight:600; color:#334155;`;

        const groupWrap = document.createElement("div");
        groupWrap.style.cssText = "display:flex; align-items:center; gap:6px; flex-wrap:wrap;";

        const nodes = [
          { node: r?.hierarchy?.epic || null, fallback: "Sem Épico" },
          { node: r?.hierarchy?.feature || null, fallback: "Sem Feature" },
          { node: r?.hierarchy?.pbi || null, fallback: "Sem PBI" },
        ];

        nodes.forEach((entry, idx) => {
          const n = entry.node;
          if (n && n.id) {
            const a = document.createElement("a");
            a.href = workItemUrl(n.id);
            a.target = "_blank";
            a.rel = "noopener";
            a.title = `${n.id} - ${n.title}`;
            a.textContent = n.title || `#${n.id}`;
            a.style.cssText = "color:#334155; text-decoration:none;";
            groupWrap.appendChild(a);
          } else {
            const span = document.createElement("span");
            span.textContent = entry.fallback;
            span.style.color = "#94a3b8";
            groupWrap.appendChild(span);
          }

          if (idx < nodes.length - 1) {
            const sep = document.createElement("span");
            sep.textContent = ">";
            sep.style.color = "#cbd5e1";
            groupWrap.appendChild(sep);
          }
        });

        const pbiId = r?.hierarchy?.pbi?.id;
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "+";
        addBtn.title = pbiId
          ? `Nova task com parent na PBI ${pbiId}`
          : "Não é possível criar task sem PBI no breadcrumb";
        addBtn.disabled = !pbiId;
        addBtn.style.cssText = pbiId
          ? "margin-left:6px; width:20px; height:20px; border:1px solid #16a34a; background:#f0fdf4; color:#166534; border-radius:999px; cursor:pointer; font-size:14px; line-height:1; font-weight:700;"
          : "margin-left:6px; width:20px; height:20px; border:1px solid #cbd5e1; background:#f8fafc; color:#94a3b8; border-radius:999px; cursor:not-allowed; font-size:14px; line-height:1; font-weight:700;";
        addBtn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!pbiId) return;
          window.open(newTaskUrlWithParent(pbiId), "_blank", "noopener");
        };
        groupWrap.appendChild(addBtn);

        tdGroup.appendChild(groupWrap);
        trGroup.appendChild(tdGroup);
        tbody.appendChild(trGroup);
        lastGroupKey = groupKey;
      }

      const tr  = document.createElement("tr");
      tr.style.background = ri % 2 === 0 ? "#fff" : "#f9fafb";

      // ID
      const tdId = document.createElement("td");
      tdId.style.cssText = `${tdBase} text-align:center; color:#555;`;
      tdId.title = "Clique para copiar o ID";
      tdId.textContent = r.id;
      tdId.style.cursor = "copy";
      tdId.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const text = String(r.id);
        try {
          if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            // Fallback para contextos sem clipboard API.
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.cssText = "position:fixed; top:-1000px; left:-1000px; opacity:0;";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
          }
          tdId.title = "Copiado!";
          window.setTimeout(() => { tdId.title = "Clique para copiar o ID"; }, 900);
        } catch (err) {
          tdId.title = `Falha ao copiar: ${err?.message || err}`;
          window.setTimeout(() => { tdId.title = "Clique para copiar o ID"; }, 1500);
        }
      };
      tr.appendChild(tdId);

      // Title
      const tdTitle = document.createElement("td");
      tdTitle.style.cssText = `${tdBase} overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
      const a = document.createElement("a");
      a.href = workItemUrl(r.id);
      a.target = "_blank";
      a.rel = "noopener";
      a.title = r.title;
      a.textContent = r.title;
      // Importante: NÃO deixar o link ocupar a célula inteira; só o texto deve ser clicável.
      a.style.cssText = "color:#0078d4; text-decoration:none; display:inline; cursor:pointer;";
      tdTitle.appendChild(a);
      tr.appendChild(tdTitle);

      // Status
      const tdStatus = document.createElement("td");
      tdStatus.style.cssText = `${tdBase} text-align:center; color:#444; white-space:nowrap;`;
      const status = String(r.status || "");
      const statusWrap = document.createElement("div");
      statusWrap.style.cssText = "display:inline-flex; align-items:center; justify-content:center; gap:6px; white-space:nowrap;";
      const statusText = document.createElement("span");
      statusText.textContent = status || "";
      statusWrap.appendChild(statusText);

      const statusNorm = status.trim().toLowerCase();
      if (!editMode && (statusNorm === "to do" || statusNorm === "in progress")) {
        const actionBtn = document.createElement("button");
        const isToDo = statusNorm === "to do";
        actionBtn.textContent = isToDo ? "▶" : "✓";
        actionBtn.title = isToDo
          ? "Iniciar: muda para In Progress e define Start Date com hoje."
          : "Fechar: muda para Done e define Finish Date com a maior data lançada.";
        actionBtn.style.cssText = isToDo
          ? "width:20px; height:20px; border:1px solid #2563eb; background:#eff6ff; color:#1d4ed8; border-radius:6px; cursor:pointer; font-size:12px; line-height:1; font-weight:700;"
          : "width:20px; height:20px; border:1px solid #16a34a; background:#f0fdf4; color:#166534; border-radius:6px; cursor:pointer; font-size:12px; line-height:1; font-weight:700;";
        actionBtn.onclick = async () => {
          if (!onStatusAction) return;
          actionBtn.disabled = true;
          actionBtn.style.opacity = "0.6";
          try {
            await onStatusAction(r.id, status);
          } finally {
            actionBtn.disabled = false;
            actionBtn.style.opacity = "1";
          }
        };
        statusWrap.appendChild(actionBtn);
      }
      tdStatus.appendChild(statusWrap);
      tr.appendChild(tdStatus);

      // Completed Work
      const tdCompletedWork = document.createElement("td");
      const hasCwMismatch = !!r.cwMismatch;
      tdCompletedWork.style.cssText = hasCwMismatch
        ? `${tdBase} text-align:center; color:#b91c1c; font-weight:700; background:#fef2f2;`
        : `${tdBase} text-align:center; color:#444;`;
      const visibleHours = computeVisibleHoursForRow(r);
      const totalCw = parseHours(r.completedWork);
      if (Math.abs(visibleHours - totalCw) <= 1e-9) {
        tdCompletedWork.textContent = fmt(totalCw);
      } else {
        tdCompletedWork.innerHTML = `<div style="line-height:1.05;">
  <div>${fmt(visibleHours)} / ${fmt(totalCw)}</div>
  <div style="font-weight:500; color:${hasCwMismatch ? "#b91c1c" : "#94a3b8"}; font-size:9px;">visible / total</div>
</div>`;
      }
      tdCompletedWork.title = hasCwMismatch
        ? `Visible in period: ${fmt(visibleHours)}h. CompletedWork total: ${fmt(totalCw)}h.\n⚠ CompletedWork differs from LH sum (${fmt(r.lhTotal || 0)}h).`
        : `Visible in period: ${fmt(visibleHours)}h. CompletedWork total: ${fmt(totalCw)}h.`;
      tr.appendChild(tdCompletedWork);

      if (showDateCols) {
        const startDate = r.startDate ? toYmd(new Date(r.startDate)) : "";
        const finishDate = r.finishDate ? toYmd(new Date(r.finishDate)) : "";

        const tdStart = document.createElement("td");
        tdStart.style.cssText = `${tdBase} text-align:center; color:#475569; white-space:nowrap;`;
        tdStart.textContent = startDate || "—";
        tdStart.title = r.startDate || "";
        tr.appendChild(tdStart);

        const tdFinish = document.createElement("td");
        tdFinish.style.cssText = `${tdBase} text-align:center; color:#475569; white-space:nowrap;`;
        tdFinish.textContent = finishDate || "—";
        tdFinish.title = r.finishDate || "";
        tr.appendChild(tdFinish);
      }

      if (showLhActions) {
        // LH consistency
        const tdLh = document.createElement("td");
        tdLh.style.cssText = `${tdBase} text-align:center;`;
        if (r.hasTracker) {
          tdLh.innerHTML = `<span class="lh-pill lh-pill--ok" title="Comentário LH| encontrado.">OK</span>`;
        } else if (r.hasLaunchHistory) {
          tdLh.innerHTML = buildMissingTrackerHint(r);
        } else {
          tdLh.innerHTML = `<span class="lh-pill lh-pill--muted" title="Sem lançamentos no histórico (CompletedWork sem aumentos).">—</span>`;
        }
        tr.appendChild(tdLh);

        // Actions
        const tdActions = document.createElement("td");
        tdActions.style.cssText = `${tdBase} text-align:center;`;
        if (!r.hasTracker && r.hasLaunchHistory && !editMode) {
          const fixBtn = document.createElement("button");
          fixBtn.textContent = "Corrigir LH";
          fixBtn.style.cssText = "padding:3px 8px; border:1px solid #ea580c; background:#fff7ed; color:#9a3412; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600;";
          fixBtn.onclick = async () => { if (onFixRow) await onFixRow(r.id); };
          tdActions.appendChild(fixBtn);
        }
        if (r.cwMismatch && !editMode) {
          const fixCwBtn = document.createElement("button");
          fixCwBtn.textContent = "🛠";
          fixCwBtn.title = `Corrigir CompletedWork para ${fmt(r.lhTotal || 0)}h (soma do LH).`;
          fixCwBtn.style.cssText = "margin-left:6px; width:22px; height:22px; border:1px solid #dc2626; background:#fef2f2; color:#b91c1c; border-radius:6px; cursor:pointer; font-size:12px; line-height:1;";
          fixCwBtn.onclick = async () => { if (onSyncCompletedWork) await onSyncCompletedWork(r.id); };
          tdActions.appendChild(fixCwBtn);
        }
        if (!tdActions.firstChild) {
          tdActions.textContent = "—";
          tdActions.style.color = "#94a3b8";
        }
        tr.appendChild(tdActions);
      }

      // Hour cells
      visibleKeys.forEach((k, ki) => {
        const isWe       = visibleDates[ki].getDay() === 0 || visibleDates[ki].getDay() === 6;
        const holiday    = holidayByKey[k] || null;
        const pk         = `${r.id}__${k}`;
        const origHours  = r.byDay[k] || 0;
        const curHours   = pendingEdits.has(pk) ? pendingEdits.get(pk) : origHours;
        const isChanged  = pendingEdits.has(pk) && Math.abs(curHours - origHours) > 1e-9;

        const td = document.createElement("td");
        if (holiday) td.title = holiday;
        td.style.cssText = `${tdBase} text-align:center;${holiday ? " background:#fff1f2;" : isWe ? " background:#fffbf0;" : ""}`;
        if (isChanged) td.classList.add("lh-cell-changed");

        if (editMode) {
          const inp = document.createElement("input");
          inp.type = "number";
          inp.min  = "0";
          inp.step = "0.5";
          inp.className   = "lh-edit-input";
          inp.value       = fmt(curHours);
          inp.dataset.id  = r.id;
          inp.dataset.day = k;
          inp.onkeydown = (ev) => {
            if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
            ev.preventDefault();
            const curVal = Math.max(0, parseHours(inp.value));
            let step = 1;
            if (ev.shiftKey) step = 2;
            else if (ev.ctrlKey || ev.metaKey) step = 0.5;
            const delta = ev.key === "ArrowUp" ? step : -step;
            const next = round2(Math.max(0, curVal + delta));
            inp.value = fmt(next);
            inp.dispatchEvent(new Event("input", { bubbles: true }));
          };
          inp.oninput = () => {
            const nv = Math.max(0, Number(inp.value) || 0);
            if (Math.abs(nv - origHours) > 1e-9) {
              pendingEdits.set(pk, nv);
              td.classList.add("lh-cell-changed");
            } else {
              pendingEdits.delete(pk);
              td.classList.remove("lh-cell-changed");
            }
            // Atualiza totais em tempo real
            const newTotals = computeTotals();
            visibleKeys.forEach(dk => {
              const el = document.getElementById(`lh-tot-${dk}`);
              if (el) el.textContent = fmt(newTotals[dk]);
            });
            const totalCompletedEl = document.getElementById("lh-tot-completed-work");
            if (totalCompletedEl) {
              const visibleTotal = computeVisibleHoursTotalFromTotals(newTotals);
              const cwTotal = computeCompletedWorkTotal();
              if (Math.abs(visibleTotal - cwTotal) <= 1e-9) {
                totalCompletedEl.textContent = fmt(cwTotal);
              } else {
                totalCompletedEl.innerHTML = `<div style="line-height:1.05;">
  <div>${fmt(visibleTotal)} / ${fmt(cwTotal)}</div>
  <div style="font-weight:500; color:#94a3b8; font-size:9px;">visible / total</div>
</div>`;
              }
            }
            if (totalsCallback) totalsCallback(pendingEdits.size > 0);
          };
          td.appendChild(inp);
        } else {
          td.textContent = fmt(r.byDay[k]);
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    // total row
    const trTot = document.createElement("tr");
    trTot.style.cssText = "font-weight:700; background:#f0f4ff;";
    const totals = computeTotals();
    const totalCompletedWork = computeCompletedWorkTotal();
    const totalVisibleHours = computeVisibleHoursTotalFromTotals(totals);

    const tdBlank1 = document.createElement("td"); tdBlank1.style.cssText = tdBase; trTot.appendChild(tdBlank1);
    const tdLabel  = document.createElement("td"); tdLabel.style.cssText = tdBase; tdLabel.textContent = "Total"; trTot.appendChild(tdLabel);
    const tdBlank2 = document.createElement("td"); tdBlank2.style.cssText = tdBase; trTot.appendChild(tdBlank2);
    const tdBlank3 = document.createElement("td");
    tdBlank3.id = "lh-tot-completed-work";
    tdBlank3.style.cssText = `${tdBase} text-align:center;`;
    if (Math.abs(totalVisibleHours - totalCompletedWork) <= 1e-9) {
      tdBlank3.textContent = fmt(totalCompletedWork);
    } else {
      tdBlank3.innerHTML = `<div style="line-height:1.05;">
  <div>${fmt(totalVisibleHours)} / ${fmt(totalCompletedWork)}</div>
  <div style="font-weight:500; color:#94a3b8; font-size:9px;">visible / total</div>
</div>`;
    }
    tdBlank3.title = `Visible in period total / sum of CompletedWork totals.`;
    trTot.appendChild(tdBlank3);
    if (showDateCols) {
      const tdBlankDate1 = document.createElement("td"); tdBlankDate1.style.cssText = tdBase; trTot.appendChild(tdBlankDate1);
      const tdBlankDate2 = document.createElement("td"); tdBlankDate2.style.cssText = tdBase; trTot.appendChild(tdBlankDate2);
    }
    if (showLhActions) {
      const tdBlank4 = document.createElement("td"); tdBlank4.style.cssText = tdBase; trTot.appendChild(tdBlank4);
      const tdBlank5 = document.createElement("td"); tdBlank5.style.cssText = tdBase; trTot.appendChild(tdBlank5);
    }
    visibleKeys.forEach(k => {
      const td = document.createElement("td");
      td.id = `lh-tot-${k}`;
      td.style.cssText = `${tdBase} text-align:center;`;
      td.textContent = fmt(totals[k]);
      trTot.appendChild(td);
    });
    tbody.appendChild(trTot);

    table.appendChild(tbody);
    const wrap = document.createElement("div");
    wrap.style.marginTop = "8px";
    wrap.appendChild(table);
    return wrap;
  }

  function parseWorkItemIdFromRelationUrl(url) {
    const m = String(url || "").match(/workItems\/(\d+)$/i);
    return m ? Number(m[1]) : null;
  }

  async function fetchWorkItemHierarchyNode(id, cache) {
    if (cache.has(id)) return cache.get(id);
    const wi = await adoFetchJson(`${ADO_BASE}/wit/workitems/${id}?$expand=relations&api-version=7.1`);
    const fields = wi?.fields || {};
    const parentRel = (wi?.relations || []).find(rel => rel.rel === "System.LinkTypes.Hierarchy-Reverse");
    const node = {
      id: Number(id),
      title: String(fields["System.Title"] || `#${id}`),
      type: String(fields["System.WorkItemType"] || ""),
      parentId: parentRel ? parseWorkItemIdFromRelationUrl(parentRel.url) : null,
    };
    cache.set(id, node);
    return node;
  }

  async function fetchTaskHierarchy(taskId, cache) {
    const taskNode = await fetchWorkItemHierarchyNode(taskId, cache);
    const ancestors = [];
    let parentId = taskNode.parentId;
    let guard = 0;
    while (parentId && guard < 10) {
      guard++;
      const node = await fetchWorkItemHierarchyNode(parentId, cache);
      ancestors.push(node);
      parentId = node.parentId;
    }

    const byType = (types) => ancestors.find(a => types.includes(String(a.type || "").toLowerCase()));
    const pbiNode = byType(["product backlog item", "pbi", "user story", "backlog item"]) || ancestors[0] || null;
    const featureNode = byType(["feature"]) || ancestors[1] || null;
    const epicNode = byType(["epic"]) || ancestors[2] || null;

    const toLite = (n) => n ? { id: n.id, title: n.title } : null;
    const epicTitle = epicNode?.title || "Sem Épico";
    const featureTitle = featureNode?.title || "Sem Feature";
    const pbiTitle = pbiNode?.title || "Sem PBI";

    return {
      epic: toLite(epicNode),
      feature: toLite(featureNode),
      pbi: toLite(pbiNode),
      groupKey: `${epicTitle} > ${featureTitle} > ${pbiTitle}`,
    };
  }

  // ── data fetch ─────────────────────────────────────────────────────────────
  async function buildPeriodData(offset, mode) {
    const info = getPeriodInfoForOffset(offset, mode);
    if (!info) return { rows: [], allDayDates: [], periodStartYmd: "", periodEndShownYmd: "", viewMode: mode };
    const { periodStartYmd, periodEndShownYmd, periodStart, periodEndExclusive, allDayDates } = info;
    const allDayKeys       = allDayDates.map(toYmd);
    const startYmd = toYmd(periodStart);
    const endExclusiveYmd = toYmd(periodEndExclusive);

    const wiql = `
      SELECT [System.Id] FROM WorkItems
      WHERE [System.AssignedTo] = @Me AND (
        ([Microsoft.VSTS.Scheduling.StartDate]  >= '${startYmd}' AND [Microsoft.VSTS.Scheduling.StartDate]  < '${endExclusiveYmd}')
        OR ([Microsoft.VSTS.Scheduling.FinishDate] >= '${startYmd}' AND [Microsoft.VSTS.Scheduling.FinishDate] < '${endExclusiveYmd}')
        OR ([System.ChangedDate] >= '${startYmd}' AND [System.ChangedDate] < '${endExclusiveYmd}')
      ) ORDER BY [System.ChangedDate] DESC`.trim();

    const wiqlData = await adoFetchJson(`${ADO_BASE}/wit/wiql?api-version=7.1`, {
      method: "POST", body: JSON.stringify({ query: wiql })
    });
    const ids = [...new Set((wiqlData.workItems || []).map(w => w.id))];
    if (ids.length === 0) return { rows: [], allDayDates, periodStartYmd, periodEndShownYmd, viewMode: mode };

    const batch = await adoFetchJson(`${ADO_BASE}/wit/workitemsbatch?api-version=7.1`, {
      method: "POST",
      body: JSON.stringify({ ids, fields: [
        "System.Id","System.Title","System.State",
        "Microsoft.VSTS.Scheduling.CompletedWork",
        "Microsoft.VSTS.Scheduling.StartDate",
        "Microsoft.VSTS.Scheduling.FinishDate"
      ]})
    });

    const itemById = new Map((batch.value || []).map(it => [it.id, it]));
    const hierarchyCache = new Map();
    const rows = [];

    for (const id of ids) {
      const item       = itemById.get(id);
      const title      = item?.fields?.["System.Title"]  || "";
      const status     = item?.fields?.["System.State"]   || "";
      const completedWork = Number(item?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"] || 0);
      const startDate  = item?.fields?.["Microsoft.VSTS.Scheduling.StartDate"];
      const finishDate = item?.fields?.["Microsoft.VSTS.Scheduling.FinishDate"];
      const hasDateInPeriod = [startDate, finishDate].some(d => d && allDayKeys.includes(toYmd(new Date(d))));
      const byDay = Object.fromEntries(allDayKeys.map(k => [k, 0]));

      const commentsData   = await adoFetchJson(`${ADO_BASE}/wit/workItems/${id}/comments?api-version=7.1-preview.3`);
      const trackerComment = getLatestLHTrackerComment(commentsData.comments || []);
      const hasTracker = !!trackerComment;
      const structuredAll = hasTracker ? collectLHEntriesFromComments(commentsData.comments || []) : [];
      const structuredWeek = structuredAll.filter(x => allDayKeys.includes(x.workDate));
      const lhTotal = hasTracker
        ? round2(structuredAll.reduce((sum, e) => sum + Math.max(0, Number(e.hours) || 0), 0))
        : null;
      const cwDiff = hasTracker ? round2(completedWork - lhTotal) : null;
      const cwMismatch = hasTracker ? Math.abs(cwDiff) > 1e-9 : false;
      let hasAnyIncrease = false;

      // Se há tracker LH, ele é a fonte de verdade (mesmo sem linhas na semana visível).
      // Evita mostrar horas por ChangedDate em semanas diferentes do work_date.
      if (trackerComment) {
        for (const s of structuredWeek) byDay[s.workDate] += s.hours;
      } else {
        // Regra especial: se StartDate e FinishDate são o mesmo dia, usar esse dia como work_date
        // e atribuir o CompletedWork atual (evita inferir por ChangedDate, que pode ser o dia seguinte).
        const startDay = startDate ? toYmd(new Date(startDate)) : null;
        const finishDay = finishDate ? toYmd(new Date(finishDate)) : null;
        const sameStartFinish = !!startDay && !!finishDay && startDay === finishDay;
        if (sameStartFinish && byDay[startDay] != null && completedWork > 1e-9) {
          byDay[startDay] = round2(completedWork);
          hasAnyIncrease = true;
        } else {
          const revData = await adoFetchJson(`${ADO_BASE}/wit/workitems/${id}/revisions?api-version=7.1`);
          const revs    = (revData.value || []).slice().sort((a,b) => (a.rev||0)-(b.rev||0));
          const parseCW = v => { const n = Number(String(v??"0").replace(",",".")); return Number.isFinite(n) ? n : 0; };
          for (let i = 0; i < revs.length; i++) {
            const cur   = revs[i], prev = i > 0 ? revs[i-1] : null;
            const delta = parseCW(cur?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"])
                        - (prev ? parseCW(prev?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"]) : 0);
            if (delta <= 0) continue;
            hasAnyIncrease = true;
            const key = toYmd(new Date(cur?.fields?.["System.ChangedDate"] || 0));
            if (byDay[key] == null) continue;
            byDay[key] += delta;
          }
        }
      }

      const hasHours = allDayKeys.some(k => Math.abs(byDay[k]) > 1e-9);
      if (hasHours || hasDateInPeriod) rows.push({
        id, title, status, completedWork, byDay, startDate, finishDate,
        hasTracker,
        hasLaunchHistory: hasTracker ? true : hasAnyIncrease,
        inconsistent: !hasTracker && hasAnyIncrease,
        lhTotal,
        cwDiff,
        cwMismatch,
        hierarchy: await fetchTaskHierarchy(id, hierarchyCache)
      });
    }

    rows.sort((a, b) => a.id - b.id);
    return { rows, allDayDates, periodStartYmd, periodEndShownYmd, viewMode: mode };
  }

  function buildFixPlan(workItem, revs) {
    const fields = workItem?.fields || {};
    const startDay = toYmdOrNull(fields["Microsoft.VSTS.Scheduling.StartDate"]);
    const finishDay = toYmdOrNull(fields["Microsoft.VSTS.Scheduling.FinishDate"]);
    const sameStartFinish = !!startDay && !!finishDay && startDay === finishDay;

    const ordered = (revs || []).slice().sort((a, b) => (a.rev || 0) - (b.rev || 0));
    const itemCompleted = parseHoursMaybe(fields["Microsoft.VSTS.Scheduling.CompletedWork"]);
    const revCompleted = ordered.length > 0
      ? parseHoursMaybe(ordered[ordered.length - 1]?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"])
      : null;
    // Em casos com formatação estranha no item atual, o último valor de revisão tende a ser mais confiável.
    const completedWork = round2(revCompleted ?? itemCompleted ?? 0);
    const positiveEvents = [];
    for (let i = 0; i < ordered.length; i++) {
      const cur = ordered[i];
      const prev = i > 0 ? ordered[i - 1] : null;
      const delta = parseHours(cur?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"]) -
                    (prev ? parseHours(prev?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"]) : 0);
      if (delta <= 1e-9) continue;
      const changedDate = cur?.fields?.["System.ChangedDate"];
      const changedDay = toYmdOrNull(changedDate);
      if (!changedDay) continue;
      positiveEvents.push({
        changedDate,
        workDate: changedDay,
        hours: round2(delta),
      });
    }

    const byDay = new Map();
    for (const e of positiveEvents) {
      byDay.set(e.workDate, round2((byDay.get(e.workDate) || 0) + e.hours));
    }

    const simpleRule = positiveEvents.length <= 1 || sameStartFinish;
    let entries = [];
    if (simpleRule) {
      const fallbackDay = positiveEvents[positiveEvents.length - 1]?.workDate || toYmd(new Date());
      const chosenDay = startDay || finishDay || fallbackDay;
      entries = [{ workDate: chosenDay, hours: completedWork }];
    } else {
      entries = [...byDay.entries()]
        .map(([workDate, hours]) => ({ workDate, hours: round2(hours) }))
        .sort((a, b) => a.workDate.localeCompare(b.workDate));
    }

    const totalPlanned = round2(entries.reduce((s, e) => s + e.hours, 0));
    const diff = round2(completedWork - totalPlanned);
    return {
      strategy: simpleRule ? "simple" : "revisions",
      completedWork,
      entries,
      totalPlanned,
      diff,
      positiveEvents,
      startDay,
      finishDay,
    };
  }

  async function fixMissingTracker(taskId) {
    const wi = await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`);
    const commentsData = await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments?api-version=7.1-preview.3`);
    const tracker = getLatestLHTrackerComment(commentsData.comments || []);
    if (tracker) return { skipped: true, reason: "Task já possui comentário LH|." };

    const revData = await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}/revisions?api-version=7.1`);
    const plan = buildFixPlan(wi, revData.value || []);
    const title = String(wi?.fields?.["System.Title"] || "");

    const historyPreview = plan.positiveEvents
      .slice(-12)
      .map(e => `${new Date(e.changedDate).toLocaleString()}  +${fmt(e.hours)}h`)
      .join("\n");

    let proceed = true;
    if (Math.abs(plan.diff) > 1e-9) {
      const msg = [
        `Task ${taskId} — ${title}`,
        "",
        "A soma dos lançamentos por revisão NÃO bate com o CompletedWork atual.",
        `CompletedWork atual: ${fmt(plan.completedWork)}h`,
        `Soma proposta LH: ${fmt(plan.totalPlanned)}h`,
        `Diferença: ${fmt(plan.diff)}h`,
        "",
        "Histórico reduzido (+delta):",
        historyPreview || "(sem lançamentos positivos detectados)",
        "",
        "Deseja continuar e gravar o LH mesmo assim?"
      ].join("\n");
      proceed = window.confirm(msg);
    }
    if (!proceed) return { skipped: true, reason: "Correção cancelada pelo usuário." };

    const newText = plan.entries
      .sort((a, b) => a.workDate.localeCompare(b.workDate))
      .map(e => `LH|work_date=${e.workDate}|hours=${e.hours}`)
      .join("\n");

    if (!newText.trim()) return { skipped: true, reason: "Nenhuma linha LH gerada para a task." };
    await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments?api-version=7.1-preview.3`, {
      method: "POST",
      body: JSON.stringify({ text: newText })
    });
    return { skipped: false, strategy: plan.strategy, diff: plan.diff, lines: plan.entries.length };
  }

  async function latestLoggedWorkDateYmd(taskId) {
    const commentsData = await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments?api-version=7.1-preview.3`);
    const tracker = getLatestLHTrackerComment(commentsData.comments || []);
    if (tracker) {
      const entries = collectLHEntriesFromComments(commentsData.comments || []).filter(e => Number(e.hours) > 1e-9);
      if (entries.length > 0) {
        return entries
          .map(e => e.workDate)
          .sort((a, b) => a.localeCompare(b))
          .slice(-1)[0];
      }
    }

    const revData = await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}/revisions?api-version=7.1`);
    const revs = (revData.value || []).slice().sort((a, b) => (a.rev || 0) - (b.rev || 0));
    let maxYmd = null;
    for (let i = 0; i < revs.length; i++) {
      const cur = revs[i];
      const prev = i > 0 ? revs[i - 1] : null;
      const delta = parseHours(cur?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"]) -
                    (prev ? parseHours(prev?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"]) : 0);
      if (delta <= 1e-9) continue;
      const day = toYmdOrNull(cur?.fields?.["System.ChangedDate"]);
      if (!day) continue;
      if (!maxYmd || day.localeCompare(maxYmd) > 0) maxYmd = day;
    }
    return maxYmd;
  }

  async function applyStatusQuickAction(taskId, currentStatus) {
    const wi = await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`);
    const fields = wi?.fields || {};
    const statusRaw = String(fields["System.State"] || currentStatus || "").trim();
    const statusNorm = statusRaw.toLowerCase();
    const patchOps = [];

    if (statusNorm === "to do") {
      const todayYmd = toYmd(new Date());
      patchOps.push({
        op: fields["System.State"] == null ? "add" : "replace",
        path: "/fields/System.State",
        value: "In Progress"
      });
      patchOps.push({
        op: fields["Microsoft.VSTS.Scheduling.StartDate"] == null ? "add" : "replace",
        path: "/fields/Microsoft.VSTS.Scheduling.StartDate",
        value: ymdToIsoAtLocalTime(todayYmd, "00:00:00")
      });
      await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json-patch+json" },
        body: JSON.stringify(patchOps)
      });
      return { skipped: false, from: statusRaw, to: "In Progress", startDate: todayYmd };
    }

    if (statusNorm === "in progress") {
      const maxWorkYmd = await latestLoggedWorkDateYmd(taskId);
      const finishYmd = maxWorkYmd || toYmd(new Date());
      patchOps.push({
        op: fields["System.State"] == null ? "add" : "replace",
        path: "/fields/System.State",
        value: "Done"
      });
      patchOps.push({
        op: fields["Microsoft.VSTS.Scheduling.FinishDate"] == null ? "add" : "replace",
        path: "/fields/Microsoft.VSTS.Scheduling.FinishDate",
        value: ymdToIsoAtLocalTime(finishYmd, "23:59:00")
      });
      await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json-patch+json" },
        body: JSON.stringify(patchOps)
      });
      return { skipped: false, from: statusRaw, to: "Done", finishDate: finishYmd, usedTodayFallback: !maxWorkYmd };
    }

    return { skipped: true, reason: `Status sem ação rápida: ${statusRaw || "(vazio)"}` };
  }

  async function syncCompletedWorkFromLH(taskId) {
    const wi = await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`);
    const fields = wi?.fields || {};
    const commentsData = await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments?api-version=7.1-preview.3`);
    const tracker = getLatestLHTrackerComment(commentsData.comments || []);
    if (!tracker) return { skipped: true, reason: "Task sem comentário LH|." };

    const entries = collectLHEntriesFromComments(commentsData.comments || []);
    const totalLoggedHours = round2(entries.reduce((sum, e) => sum + Math.max(0, Number(e.hours) || 0), 0));
    const curCW = parseHours(fields["Microsoft.VSTS.Scheduling.CompletedWork"]);
    if (Math.abs(curCW - totalLoggedHours) <= 1e-9) {
      return { skipped: true, reason: "CompletedWork já está alinhado com o LH." };
    }

    await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json-patch+json" },
      body: JSON.stringify([{
        op: fields["Microsoft.VSTS.Scheduling.CompletedWork"] == null ? "add" : "replace",
        path: "/fields/Microsoft.VSTS.Scheduling.CompletedWork",
        value: totalLoggedHours
      }])
    });

    return { skipped: false, from: curCW, to: totalLoggedHours };
  }

  // ── save edits ─────────────────────────────────────────────────────────────
  async function saveEdits() {
    // Agrupa edições por task
    const taskMap = new Map();
    for (const [pk, newVal] of pendingEdits.entries()) {
      const [idStr, dayKey] = pk.split("__");
      const id = Number(idStr);
      if (!taskMap.has(id)) taskMap.set(id, {});
      const origRow  = editBaseData.rows.find(r => r.id === id);
      const origHours = origRow?.byDay[dayKey] || 0;
      taskMap.get(id)[dayKey] = { orig: origHours, next: newVal };
    }

    for (const [taskId, dayChanges] of taskMap.entries()) {
      const wi = await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`);
      const fields = wi.fields || {};
      const patchOps = [];

      // 2) Atualiza tracker LH|
      const commentsData = await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments?api-version=7.1-preview.3`);
      const tracker = getLatestLHTrackerComment(commentsData.comments || []);
      const allEntries = tracker ? collectLHEntriesFromComments(commentsData.comments || []) : [];

      for (const [dayKey, {next: newHours}] of Object.entries(dayChanges)) {
        const idx = allEntries.findIndex(e => e.workDate === dayKey);
        if (newHours > 0) {
          if (idx >= 0) allEntries[idx].hours = newHours;
          else allEntries.push({ workDate: dayKey, hours: newHours });
        } else {
          if (idx >= 0) allEntries.splice(idx, 1);
        }
      }

      const activeDates = [...new Set(
        allEntries
          .filter(e => Number(e.hours) > 1e-9)
          .map(e => e.workDate)
      )].sort();

      // 1) Recalcula CompletedWork pela soma final das horas lançadas no LH
      const totalLoggedHours = round2(
        allEntries.reduce((sum, e) => sum + Math.max(0, Number(e.hours) || 0), 0)
      );
      const curCW = parseHours(fields["Microsoft.VSTS.Scheduling.CompletedWork"]);
      if (Math.abs(curCW - totalLoggedHours) > 1e-9) {
        patchOps.push({
          op: fields["Microsoft.VSTS.Scheduling.CompletedWork"] == null ? "add" : "replace",
          path: "/fields/Microsoft.VSTS.Scheduling.CompletedWork",
          value: totalLoggedHours
        });
      }

      // 3) Atualiza Start/FinishDate com base nos dias que possuem lançamento no LH
      if (activeDates.length > 0) {
        const nextStartYmd = activeDates[0];
        const nextFinishYmd = activeDates[activeDates.length - 1];
        const curStartYmd = toYmdOrNull(fields["Microsoft.VSTS.Scheduling.StartDate"]);
        const curFinishYmd = toYmdOrNull(fields["Microsoft.VSTS.Scheduling.FinishDate"]);

        if (curStartYmd !== nextStartYmd) {
          patchOps.push({
            op: fields["Microsoft.VSTS.Scheduling.StartDate"] == null ? "add" : "replace",
            path: "/fields/Microsoft.VSTS.Scheduling.StartDate",
            value: ymdToIsoAtLocalTime(nextStartYmd, "00:00:00")
          });
        }
        if (curFinishYmd !== nextFinishYmd) {
          patchOps.push({
            op: fields["Microsoft.VSTS.Scheduling.FinishDate"] == null ? "add" : "replace",
            path: "/fields/Microsoft.VSTS.Scheduling.FinishDate",
            value: ymdToIsoAtLocalTime(nextFinishYmd, "23:59:00")
          });
        }
      }

      const newText = allEntries
        .sort((a,b) => a.workDate.localeCompare(b.workDate))
        .map(e => `LH|work_date=${e.workDate}|hours=${e.hours}`)
        .join("\n");

      if (patchOps.length > 0) {
        await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json-patch+json" },
          body: JSON.stringify(patchOps)
        });
      }

      if (newText) {
        if (tracker?.id != null) {
          try {
            await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments/${tracker.id}?api-version=7.1-preview.3`, {
              method: "PATCH",
              body: JSON.stringify({ text: newText })
            });
          } catch {
            // Fallback para compatibilidade de API/permissão.
            await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments?api-version=7.1-preview.3`, {
              method: "POST",
              body: JSON.stringify({ text: newText })
            });
          }
        } else {
          await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments?api-version=7.1-preview.3`, {
            method: "POST",
            body: JSON.stringify({ text: newText })
          });
        }
      }
    }
  }

  // ── modal controller ───────────────────────────────────────────────────────
  async function openModal() {
    const wrap = document.createElement("div");
    wrap.innerHTML = modalHtml();
    document.body.appendChild(wrap.firstElementChild);

    const modal         = document.getElementById(MODAL_ID);
    const closeBtn      = document.getElementById("lh-close-btn");
    const refreshBtn    = document.getElementById("lh-refresh-btn");
    const editBtn       = document.getElementById("lh-edit-btn");
    const cancelBtn     = document.getElementById("lh-cancel-btn");
    const saveBtn       = document.getElementById("lh-save-btn");
    const saveSpinner   = document.getElementById("lh-save-spinner");
    const prevBtn       = document.getElementById("lh-prev-btn");
    const nextBtn       = document.getElementById("lh-next-btn");
    const modeWeekBtn   = document.getElementById("lh-mode-week");
    const modeMonthBtn  = document.getElementById("lh-mode-month");
    const modeRangeBtn  = document.getElementById("lh-mode-range");
    const spinner       = document.getElementById("lh-spinner");
    const weekLabel     = document.getElementById("lh-week-label");
    const rangeInline   = document.getElementById("lh-range-inline");
    const rangeStartInp = document.getElementById("lh-range-start");
    const rangeEndInp   = document.getElementById("lh-range-end");
    const weekendToggle = document.getElementById("lh-weekend-toggle");
    const weekendAlert = document.getElementById("lh-weekend-alert");
    const hierarchyToggle = document.getElementById("lh-hierarchy-toggle");
    const dateColsToggle = document.getElementById("lh-date-cols-toggle");
    const lhActionsToggle = document.getElementById("lh-lh-actions-toggle");
    const lhActionsAlert = document.getElementById("lh-lh-actions-alert");
    const content       = document.getElementById("lh-content");
    const meta          = document.getElementById("lh-meta");

    weekendToggle.checked = showWeekends;
    hierarchyToggle.checked = groupByHierarchy;
    dateColsToggle.checked = showDateCols;
    lhActionsToggle.checked = showLhActions;

    let cachedData = null;
    const setModeButtonStyles = () => {
      const activeCss = "padding:5px 11px; border:1px solid #2563eb; background:#2563eb; color:#fff; border-radius:7px; cursor:pointer; font-size:12px; font-weight:600;";
      modeWeekBtn.style.cssText = viewMode === "week" ? activeCss : btnCss();
      modeMonthBtn.style.cssText = viewMode === "month" ? activeCss : btnCss();
      modeRangeBtn.style.cssText = viewMode === "range" ? activeCss : btnCss();
    };
    const syncRangeControlsUI = () => {
      const isRange = viewMode === "range";
      if (rangeInline) rangeInline.style.display = isRange ? "flex" : "none";
      if (weekLabel) weekLabel.style.display = isRange ? "none" : "";
      // Em modo período, a tabela pode estar deslocada (periodOffset). Os inputs devem refletir o range efetivo exibido.
      const eff = isRange ? getEffectiveRangeForOffset(periodOffset) : null;
      const start = eff?.startYmd || rangeStartYmd;
      const end = eff?.endYmd || rangeEndYmd;
      if (rangeStartInp) rangeStartInp.value = isValidYmd(start) ? start : "";
      if (rangeEndInp) rangeEndInp.value = isValidYmd(end) ? end : "";
    };
    setModeButtonStyles();
    syncRangeControlsUI();

    const setSpinner    = on => { spinner.style.display = on ? "inline-block" : "none"; };
    const setSaveSpinner = on => { saveSpinner.style.display = on ? "inline-block" : "none"; };

    const setNavEnabled = (on) => {
      prevBtn.disabled = !on;
      nextBtn.disabled = !on || (viewMode !== "range" && periodOffset >= 0);
      refreshBtn.disabled = !on;
      weekendToggle.disabled = !on;
      hierarchyToggle.disabled = !on;
      dateColsToggle.disabled = !on;
      lhActionsToggle.disabled = !on;
      modeWeekBtn.disabled = !on || editMode;
      modeMonthBtn.disabled = !on || editMode;
      modeRangeBtn.disabled = !on || editMode;
      if (rangeStartInp) rangeStartInp.disabled = !on || editMode;
      if (rangeEndInp) rangeEndInp.disabled = !on || editMode;
    };
    const setLhActionsAlert = (rows = []) => {
      const inconsistentCount = rows.filter(r => r.inconsistent).length;
      const cwMismatchCount = rows.filter(r => r.cwMismatch).length;
      const totalIssues = inconsistentCount + cwMismatchCount;
      lhActionsAlert.style.display = totalIssues > 0 ? "inline-flex" : "none";
      if (totalIssues > 0) {
        lhActionsAlert.title = `${inconsistentCount} sem LH, ${cwMismatchCount} com divergência CW x LH`;
      } else {
        lhActionsAlert.title = "";
      }
    };
    const setWeekendAlert = (data) => {
      if (!weekendAlert || !data) return;
      const weekendKeys = (data.allDayDates || [])
        .filter(d => d.getDay() === 0 || d.getDay() === 6)
        .map(toYmd);
      const hiddenWeekendHours = round2((data.rows || []).reduce((sum, r) => {
        return sum + weekendKeys.reduce((s, k) => s + Number(r?.byDay?.[k] || 0), 0);
      }, 0));
      const hasHiddenWeekendHours = !showWeekends && hiddenWeekendHours > 1e-9;
      weekendAlert.style.display = hasHiddenWeekendHours ? "inline-flex" : "none";
      weekendAlert.title = hasHiddenWeekendHours
        ? `${fmt(hiddenWeekendHours)}h lançadas no fim de semana estão ocultas. Marque o toggle para exibir.`
        : "";
    };

    const updateNavUI = (periodStartYmd, periodEndShownYmd) => {
      const tag = viewMode === "range"
        ? (periodOffset === 0 ? " (período)" : ` (${Math.abs(periodOffset)}p atrás)`)
        : viewMode === "month"
        ? (periodOffset === 0 ? " (mês atual)" : periodOffset === -1 ? " (mês passado)" : ` (${Math.abs(periodOffset)}m atrás)`)
        : (periodOffset === 0 ? " (semana atual)" : periodOffset === -1 ? " (semana passada)" : ` (${Math.abs(periodOffset)}s atrás)`);
      weekLabel.textContent = `${periodStartYmd}  →  ${periodEndShownYmd}${tag}`;
      const lockNext = viewMode !== "range" && periodOffset >= 0;
      nextBtn.disabled = lockNext;
      nextBtn.style.opacity = lockNext ? "0.4" : "1";
      setModeButtonStyles();
      syncRangeControlsUI();
    };

    const setEditModeUI = (active) => {
      editMode = active;
      editBtn.style.display    = active ? "none"         : "";
      cancelBtn.style.display  = active ? ""             : "none";
      saveBtn.style.display    = active ? ""             : "none";
      refreshBtn.style.display = active ? "none"         : "";
      setNavEnabled(!active);
      saveBtn.style.opacity = "0.5";
      saveBtn.disabled = true;
    };

    // Renderiza tabela no conteúdo, passando callback para habilitar botão Salvar
    const renderInto = (data) => {
      content.innerHTML = "";
      content.appendChild(renderTable(data, (hasChanges) => {
        saveBtn.style.opacity = hasChanges ? "1" : "0.5";
        saveBtn.disabled = !hasChanges;
      }, async (taskId) => {
        setSpinner(true);
        setNavEnabled(false);
        meta.textContent = `Corrigindo LH da task ${taskId}…`;
        try {
          const res = await fixMissingTracker(taskId);
          if (res.skipped) {
            meta.textContent = `ℹ️ ${res.reason}`;
          } else {
            const diffTxt = Math.abs(res.diff || 0) > 1e-9 ? ` (diferença: ${fmt(res.diff)}h)` : "";
            meta.textContent = `✅ LH corrigido na task ${taskId} via estratégia "${res.strategy}" (${res.lines} linha(s))${diffTxt}.`;
            await loadPeriod(periodOffset, true);
          }
        } catch (err) {
          meta.textContent = `❌ Erro ao corrigir task ${taskId}: ${err?.message || err}`;
        } finally {
          setSpinner(false);
          setNavEnabled(true);
        }
      }, async (taskId, status) => {
        setSpinner(true);
        setNavEnabled(false);
        const statusNorm = String(status || "").trim().toLowerCase();
        const actionLabel = statusNorm === "to do" ? "Iniciar" : statusNorm === "in progress" ? "Fechar" : "Atualizar";
        meta.textContent = `${actionLabel} task ${taskId}…`;
        try {
          const res = await applyStatusQuickAction(taskId, status);
          if (res.skipped) {
            meta.textContent = `ℹ️ ${res.reason}`;
          } else if (res.to === "In Progress") {
            meta.textContent = `✅ Task ${taskId}: ${res.from} → ${res.to} (Start Date: ${res.startDate}).`;
            await loadPeriod(periodOffset, true);
          } else if (res.to === "Done") {
            const fallbackTxt = res.usedTodayFallback ? " (sem LH detectado; usado dia atual)" : "";
            meta.textContent = `✅ Task ${taskId}: ${res.from} → ${res.to} (Finish Date: ${res.finishDate})${fallbackTxt}.`;
            await loadPeriod(periodOffset, true);
          } else {
            meta.textContent = `✅ Task ${taskId} atualizada.`;
            await loadPeriod(periodOffset, true);
          }
        } catch (err) {
          meta.textContent = `❌ Erro ao atualizar status da task ${taskId}: ${err?.message || err}`;
        } finally {
          setSpinner(false);
          setNavEnabled(true);
        }
      }, async (taskId) => {
        setSpinner(true);
        setNavEnabled(false);
        meta.textContent = `Corrigindo CompletedWork da task ${taskId}…`;
        try {
          const res = await syncCompletedWorkFromLH(taskId);
          if (res.skipped) {
            meta.textContent = `ℹ️ ${res.reason}`;
          } else {
            meta.textContent = `✅ Task ${taskId}: CompletedWork ${fmt(res.from)}h → ${fmt(res.to)}h (soma do LH).`;
            await loadPeriod(periodOffset, true);
          }
        } catch (err) {
          meta.textContent = `❌ Erro ao corrigir CompletedWork da task ${taskId}: ${err?.message || err}`;
        } finally {
          setSpinner(false);
          setNavEnabled(true);
        }
      }));
    };

    const loadPeriod = async (offset, forceRefresh = false) => {
      if (editMode) setEditModeUI(false);
      pendingEdits.clear();
      editBaseData = null;

      const info = getPeriodInfoForOffset(offset, viewMode);
      if (!info) {
        content.innerHTML = `<pre style="white-space:pre-wrap; color:#b91c1c; background:#fff1f2;
          border:1px solid #fecdd3; padding:10px; border-radius:8px;">Selecione um período válido (início e fim) para carregar.</pre>`;
        meta.textContent = "Período inválido.";
        return;
      }

      if (viewMode === "range") {
        const days = info.rangeDays || diffDaysInclusive(info.periodStartYmd, info.periodEndShownYmd) || 0;
        if (days > MAX_RANGE_DAYS) {
          content.innerHTML = `<pre style="white-space:pre-wrap; color:#b91c1c; background:#fff1f2;
            border:1px solid #fecdd3; padding:10px; border-radius:8px;">Período muito grande: ${days} dias.\nLimite atual: ${MAX_RANGE_DAYS} dias.\nAjuste o intervalo nas datas.</pre>`;
          meta.textContent = `Período muito grande (${days}d).`;
          updateNavUI(info.periodStartYmd, info.periodEndShownYmd);
          return;
        }
      }

      const cached = lsLoad(viewMode, info.periodStartYmd, info.periodEndShownYmd);

      setSpinner(true);
      setNavEnabled(false);

      if (cached && !forceRefresh) {
        cachedData = cached;
        updateNavUI(cached.periodStartYmd, cached.periodEndShownYmd);
        renderInto(cached);
        setLhActionsAlert(cached.rows || []);
        setWeekendAlert(cached);
        meta.textContent = `Cache de ${new Date(cached.ts).toLocaleString()} — atualizando…`;
      } else if (!content.firstChild) {
        content.innerHTML = `<div style="padding:12px; color:#666;">Carregando…</div>`;
      }

      try {
        const t0 = performance.now();
        const data = await buildPeriodData(offset, viewMode);
        const t1 = performance.now();
        cachedData = data;
        lsSave(data);
        updateNavUI(data.periodStartYmd, data.periodEndShownYmd);
        renderInto(data);
        setLhActionsAlert(data.rows || []);
        setWeekendAlert(data);
        const inconsistentCount = data.rows.filter(r => r.inconsistent).length;
        const cwMismatchCount = data.rows.filter(r => r.cwMismatch).length;
        const issuesText = (inconsistentCount + cwMismatchCount) > 0
          ? ` — ⚠️ ${inconsistentCount} sem LH, ${cwMismatchCount} com CW != LH`
          : " — sem inconsistências de LH/CW";
        meta.textContent = `Atualizado em ${new Date().toLocaleString()} (${Math.round(t1 - t0)} ms)${issuesText}`;
      } catch (err) {
        if (!cached) {
          content.innerHTML = `<pre style="white-space:pre-wrap; color:#b91c1c; background:#fff1f2;
            border:1px solid #fecdd3; padding:10px; border-radius:8px;">${String(err?.message || err)}</pre>`;
        }
        meta.textContent = `Erro ao atualizar: ${err?.message || err}`;
      } finally {
        setSpinner(false);
        setNavEnabled(true);
        // Mantém o range real retornado em sucesso/cache.
        if (!editMode && !cachedData) {
          const safeInfo = getPeriodInfoForOffset(offset, viewMode);
          if (safeInfo) updateNavUI(safeInfo.periodStartYmd, safeInfo.periodEndShownYmd);
        }
      }
    };

    // ── edit mode ─────────────────────────────────────────────────────────────
    editBtn.onclick = () => {
      if (!cachedData) return;
      pendingEdits.clear();
      editBaseData = cachedData;
      setEditModeUI(true);
      renderInto(cachedData);
      meta.textContent = "Modo edição: altere as horas nas células e clique em Salvar.";
    };

    cancelBtn.onclick = () => {
      pendingEdits.clear();
      editBaseData = null;
      setEditModeUI(false);
      if (cachedData) renderInto(cachedData);
      meta.textContent = "Edição cancelada.";
    };

    saveBtn.onclick = async () => {
      if (pendingEdits.size === 0) return;
      setSaveSpinner(true);
      saveBtn.disabled = true;
      cancelBtn.disabled = true;
      const n = new Set([...pendingEdits.keys()].map(k => k.split("__")[0])).size;
      meta.textContent = `Salvando ${n} task(s)…`;
      try {
        await saveEdits();
        pendingEdits.clear();
        editBaseData = null;
        setEditModeUI(false);
        meta.textContent = `✅ Salvo! Atualizando dados…`;
        await loadPeriod(periodOffset, true);
      } catch (err) {
        meta.textContent = `❌ Erro ao salvar: ${err?.message || err}`;
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
      } finally {
        setSaveSpinner(false);
      }
    };

    // ── nav / close ───────────────────────────────────────────────────────────
    const isTypingContext = (target) => {
      if (!target) return false;
      const tag = String(target.tagName || "").toUpperCase();
      return tag === "INPUT" || tag === "TEXTAREA" || !!target.isContentEditable;
    };
    const modalHotkeysHandler = (e) => {
      if (!document.getElementById(MODAL_ID)) return;
      const key = String(e.key || "").toLowerCase();
      if (key === "escape" && editMode) {
        e.preventDefault();
        cancelBtn.click();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === "s" && editMode) {
        e.preventDefault();
        if (!saveBtn.disabled) saveBtn.click();
        return;
      }
      if (!editMode && !e.ctrlKey && !e.metaKey && !e.altKey && key === "e" && !isTypingContext(e.target)) {
        e.preventDefault();
        editBtn.click();
        return;
      }
      if (!editMode && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingContext(e.target)) {
        if (key === "arrowleft") {
          e.preventDefault();
          if (!prevBtn.disabled) prevBtn.click();
          return;
        }
        if (key === "arrowright") {
          e.preventDefault();
          if (!nextBtn.disabled) nextBtn.click();
        }
      }
    };
    document.addEventListener("keydown", modalHotkeysHandler);
    const close = () => {
      document.removeEventListener("keydown", modalHotkeysHandler);
      modal?.remove();
    };
    closeBtn.onclick = close;
    modal.addEventListener("click", e => {
      if (e.target !== modal) return;
      if (editMode) {
        meta.textContent = "Finalize ou cancele a edição antes de fechar a janela.";
        return;
      }
      close();
    });

    refreshBtn.onclick = () => loadPeriod(periodOffset, true);

    prevBtn.onclick = async () => { periodOffset--; await loadPeriod(periodOffset); };
    nextBtn.onclick = async () => {
      if (viewMode === "range") { periodOffset++; await loadPeriod(periodOffset); return; }
      if (periodOffset < 0) { periodOffset++; await loadPeriod(periodOffset); }
    };

    weekendToggle.onchange = () => {
      showWeekends = weekendToggle.checked;
      try { localStorage.setItem(LS_WEEKENDS, showWeekends ? "1" : "0"); } catch {}
      if (cachedData) renderInto(cachedData);
      if (cachedData) setWeekendAlert(cachedData);
    };

    hierarchyToggle.onchange = () => {
      groupByHierarchy = hierarchyToggle.checked;
      try { localStorage.setItem(LS_HIERARCHY, groupByHierarchy ? "1" : "0"); } catch {}
      if (cachedData) renderInto(cachedData);
    };

    dateColsToggle.onchange = () => {
      showDateCols = dateColsToggle.checked;
      try { localStorage.setItem(LS_DATE_COLS, showDateCols ? "1" : "0"); } catch {}
      if (cachedData) renderInto(cachedData);
    };
    lhActionsToggle.onchange = () => {
      showLhActions = lhActionsToggle.checked;
      try { localStorage.setItem(LS_LH_ACTIONS, showLhActions ? "1" : "0"); } catch {}
      if (cachedData) renderInto(cachedData);
      setLhActionsAlert((cachedData && cachedData.rows) || []);
    };

    modeWeekBtn.onclick = async () => {
      if (editMode || viewMode === "week") return;
      viewMode = "week";
      periodOffset = 0;
      try { localStorage.setItem(LS_VIEW_MODE, viewMode); } catch {}
      await loadPeriod(periodOffset, true);
    };

    modeMonthBtn.onclick = async () => {
      if (editMode || viewMode === "month") return;
      viewMode = "month";
      periodOffset = 0;
      try { localStorage.setItem(LS_VIEW_MODE, viewMode); } catch {}
      await loadPeriod(periodOffset, true);
    };

    modeRangeBtn.onclick = async () => {
      if (editMode || viewMode === "range") return;
      viewMode = "range";
      periodOffset = 0;
      try { localStorage.setItem(LS_VIEW_MODE, viewMode); } catch {}
      syncRangeControlsUI();
      // Não força load se não houver range válido ainda.
      if (diffDaysInclusive(rangeStartYmd, rangeEndYmd)) {
        await loadPeriod(periodOffset, true);
      } else {
        meta.textContent = "Selecione início e fim; o filtro aplica ao alterar as datas.";
        const today = toYmd(new Date());
        updateNavUI(today, today);
      }
    };

    const applyRange = async () => {
      const nextStart = String(rangeStartInp?.value || "").trim();
      const nextEnd = String(rangeEndInp?.value || "").trim();
      if (!isValidYmd(nextStart) || !isValidYmd(nextEnd)) {
        meta.textContent = "Informe início e fim válidos.";
        return;
      }
      const days = diffDaysInclusive(nextStart, nextEnd);
      if (!days) {
        meta.textContent = "Período inválido: fim deve ser >= início.";
        return;
      }
      if (days > MAX_RANGE_DAYS) {
        meta.textContent = `Período muito grande (${days}d). Limite: ${MAX_RANGE_DAYS}d.`;
        return;
      }
      rangeStartYmd = nextStart;
      rangeEndYmd = nextEnd;
      persistRange();
      viewMode = "range";
      periodOffset = 0;
      try { localStorage.setItem(LS_VIEW_MODE, viewMode); } catch {}
      syncRangeControlsUI();
      await loadPeriod(periodOffset, true);
    };

    if (rangeStartInp) {
      rangeStartInp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); void applyRange(); } };
      rangeStartInp.addEventListener("change", () => {
        if (viewMode !== "range" || editMode) return;
        void applyRange();
      });
    }
    if (rangeEndInp) {
      rangeEndInp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); void applyRange(); } };
      rangeEndInp.addEventListener("change", () => {
        if (viewMode !== "range" || editMode) return;
        void applyRange();
      });
    }

    ensureHolidaysLoaded();
    await loadPeriod(periodOffset);
  }

  // ── floating button ────────────────────────────────────────────────────────
  const btn = document.createElement("button");
  btn.id = WIDGET_ID;
  btn.title = `Weekly Hours (build ${BUILD_VERSION})`;
  btn.innerText = "🕒";
  btn.style.cssText = `
    position:fixed; right:18px; bottom:18px; width:52px; height:52px;
    border-radius:50%; border:1px solid #cbd5e1; background:#0f172a; color:#fff;
    font-size:24px; cursor:pointer; z-index:2147483645;
    box-shadow:0 10px 24px rgba(0,0,0,.28);
  `;
  const triggerOpen = () => { if (!document.getElementById(MODAL_ID)) openModal(); };
  btn.onclick = triggerOpen;
  document.body.appendChild(btn);

  document.addEventListener("keydown", e => {
    if (e.key === KEY_OPEN_MODAL) {
      e.preventDefault();
      const modal = document.getElementById(MODAL_ID);
      if (modal) {
        const closeBtn = document.getElementById("lh-close-btn");
        if (closeBtn) closeBtn.click();
        else modal.remove();
      }
      else triggerOpen();
    }
  });
})();
