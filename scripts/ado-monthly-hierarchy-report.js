(() => {
  const WIDGET_ID = "__lh_monthly_hierarchy_btn__";
  const MODAL_ID = "__lh_monthly_hierarchy_modal__";
  const LS_PREFIX = "__lh_monthly_hierarchy_v1_";
  const LS_WEEKENDS = "__lh_monthly_hierarchy_show_weekends__";
  const LS_LAST_MONTH = "__lh_monthly_hierarchy_last_month__";
  const KEY_OPEN_MODAL = "F3";
  const LS_FLOATING_BTNS_HIDDEN = "__lh_floating_buttons_hidden__";
  const BUILD_VERSION = __BUILD_VERSION__;

  if (document.getElementById(WIDGET_ID)) document.getElementById(WIDGET_ID).remove();
  if (document.getElementById(MODAL_ID)) document.getElementById(MODAL_ID).remove();

  if (!document.getElementById("__lh_monthly_hierarchy_styles__")) {
    const s = document.createElement("style");
    s.id = "__lh_monthly_hierarchy_styles__";
    s.textContent = `
      @keyframes __lh_monthly_spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }

  const pad2 = (n) => String(n).padStart(2, "0");
  const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const round2 = (n) => Number((Number(n) || 0).toFixed(2));
  const fmt = (n) => {
    if (!n) return "";
    return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  };

  function monthStartYmdForOffset(offset) {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return toYmd(d);
  }

  function monthOffsetFromStartYmd(monthStartYmd) {
    const d = new Date(String(monthStartYmd || "") + "T00:00:00");
    if (Number.isNaN(d.getTime())) return 0;
    const now = new Date();
    return ((d.getFullYear() - now.getFullYear()) * 12) + (d.getMonth() - now.getMonth());
  }

  function allDayDatesForMonth(monthStartYmd) {
    const start = new Date(monthStartYmd + "T00:00:00");
    const dates = [];
    const cursor = new Date(start);
    while (cursor.getMonth() === start.getMonth()) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function normalizeCommentText(text) {
    if (!text) return "";
    return text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .trim();
  }

  function parseLHLine(line) {
    const t = line.trim();
    if (!t.startsWith("LH|")) return null;
    const obj = {};
    t.slice(3).split("|").forEach((p) => {
      const i = p.indexOf("=");
      if (i > 0) obj[p.slice(0, i)] = p.slice(i + 1);
    });
    if (!obj.work_date || obj.hours == null) return null;
    const h = Number(String(obj.hours).replace(",", "."));
    return Number.isFinite(h) ? { workDate: obj.work_date, hours: h } : null;
  }

  function parseLHTracker(commentText) {
    const plain = normalizeCommentText(commentText);
    if (!plain.startsWith("LH|")) return null;
    return plain.split(/\r?\n/).map(parseLHLine).filter(Boolean);
  }

  function getLHTrackerComments(comments) {
    return (comments || []).filter((c) => normalizeCommentText(c?.text).startsWith("LH|"));
  }

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

  function parseHours(v) {
    const n = Number(String(v ?? "0").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
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

    if (location.hostname !== "dev.azure.com" || !org || !project) {
      throw new Error("Abra no domínio dev.azure.com/{org}/{project}.");
    }
    return { org, project };
  }

  const { org: ORG, project: PROJECT } = parseOrgProject();
  const ADO_BASE = `https://dev.azure.com/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}/_apis`;

  function areFloatingButtonsHidden() {
    try { return localStorage.getItem(LS_FLOATING_BTNS_HIDDEN) === "1"; } catch { return false; }
  }

  function applyFloatingButtonsVisibility() {
    const hidden = areFloatingButtonsHidden();
    const ids = ["__lh_weekly_widget_btn__", "__lh_monthly_hierarchy_btn__"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.style.display = hidden ? "none" : "";
    }
  }

  function ensureFloatingButtonsHotkeyInstalled() {
    if (window.__lhFloatingButtonsHotkeyInstalled) return;
    window.__lhFloatingButtonsHotkeyInstalled = true;
    document.addEventListener("keydown", (e) => {
      const key = String(e.key || "");
      const code = String(e.code || "");
      const isCtrlF2 = (e.ctrlKey || e.metaKey) && !e.altKey && (code === "F2" || key === "F2");
      if (!isCtrlF2) return;
      e.preventDefault();
      e.stopPropagation();
      const next = !areFloatingButtonsHidden();
      try { localStorage.setItem(LS_FLOATING_BTNS_HIDDEN, next ? "1" : "0"); } catch {}
      applyFloatingButtonsVisibility();
    }, true);
  }

  async function adoFetchJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
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

  function captureElementAsCanvas(target) {
    const table = target?.querySelector?.("table");
    if (!table) throw new Error("Tabela não encontrada para captura.");

    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length === 0) throw new Error("Tabela sem linhas para captura.");

    const firstRowCells = Array.from(rows[0].children);
    if (firstRowCells.length === 0) throw new Error("Tabela inválida para captura.");
    const colWidths = firstRowCells.map((cell) => Math.ceil(cell.getBoundingClientRect().width || 0));
    const tableWidth = Math.max(1, colWidths.reduce((sum, w) => sum + Math.max(1, w), 0));
    const rowHeights = rows.map((row) => Math.max(1, Math.ceil(row.getBoundingClientRect().height || 0)));
    const tableHeight = Math.max(1, rowHeights.reduce((sum, h) => sum + h, 0));

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = tableWidth * scale;
    canvas.height = tableHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível no navegador.");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tableWidth, tableHeight);

    let y = 0;
    rows.forEach((row, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      let x = 0;
      let colIdx = 0;
      const cells = Array.from(row.children);

      cells.forEach((cell) => {
        const colSpan = Math.max(1, Number(cell.colSpan || 1));
        const cellWidth = colWidths.slice(colIdx, colIdx + colSpan).reduce((sum, w) => sum + w, 0);
        const style = window.getComputedStyle(cell);

        const bg = style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" ? style.backgroundColor : "#ffffff";
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, cellWidth, rowHeight);

        const borderColor = style.borderColor || "#dddddd";
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, cellWidth - 1), Math.max(0, rowHeight - 1));

        const fontSize = parseFloat(style.fontSize) || 12;
        const fontWeight = style.fontWeight || "400";
        const fontFamily = style.fontFamily || "Segoe UI, Arial, sans-serif";
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = style.color || "#111827";
        ctx.textBaseline = "middle";

        const rawText = (cell.innerText || cell.textContent || "").replace(/\r/g, "").trim();
        const lines = rawText ? rawText.split("\n") : [""];
        const lineHeight = Math.max(12, Math.round(fontSize * 1.25));
        const blockHeight = lineHeight * lines.length;
        let textY = y + Math.max(8, (rowHeight - blockHeight) / 2) + (lineHeight / 2);
        const align = style.textAlign || "left";
        const padding = 7;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, y + 1, Math.max(0, cellWidth - 2), Math.max(0, rowHeight - 2));
        ctx.clip();
        for (const line of lines) {
          const t = line.trim();
          let textX = x + padding;
          if (align === "center") textX = x + cellWidth / 2;
          if (align === "right" || align === "end") textX = x + cellWidth - padding;
          ctx.textAlign = align === "center" ? "center" : (align === "right" || align === "end" ? "right" : "left");
          ctx.fillText(t, textX, textY);
          textY += lineHeight;
        }
        ctx.restore();

        x += cellWidth;
        colIdx += colSpan;
      });

      y += rowHeight;
    });

    return canvas;
  }

  function parseWorkItemIdFromRelationUrl(url) {
    const m = String(url || "").match(/workItems\/(\d+)$/i);
    return m ? Number(m[1]) : null;
  }

  async function fetchWorkItemHierarchyNode(id, cache) {
    if (cache.has(id)) return cache.get(id);
    const wi = await adoFetchJson(`${ADO_BASE}/wit/workitems/${id}?$expand=relations&api-version=7.1`);
    const fields = wi?.fields || {};
    const parentRel = (wi?.relations || []).find((rel) => rel.rel === "System.LinkTypes.Hierarchy-Reverse");
    const node = {
      id: Number(id),
      title: String(fields["System.Title"] || `#${id}`),
      type: String(fields["System.WorkItemType"] || ""),
      parentId: parentRel ? parseWorkItemIdFromRelationUrl(parentRel.url) : null
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

    const byType = (types) => ancestors.find((a) => types.includes(String(a.type || "").toLowerCase()));
    const pbiNode = byType(["product backlog item", "pbi", "user story", "backlog item"]) || ancestors[0] || null;
    const featureNode = byType(["feature"]) || ancestors[1] || null;
    const epicNode = byType(["epic"]) || ancestors[2] || null;

    const epicTitle = epicNode?.title || "Sem Épico";
    const featureTitle = featureNode?.title || "Sem Feature";
    const pbiTitle = pbiNode?.title || "Sem PBI";

    return {
      epicTitle,
      featureTitle,
      pbiTitle,
      groupKey: `${epicTitle} > ${featureTitle} > ${pbiTitle}`
    };
  }

  function lsKey(monthStartYmd) {
    return `${LS_PREFIX}${monthStartYmd}`;
  }

  function lsSave(data) {
    try {
      localStorage.setItem(lsKey(data.monthStartYmd), JSON.stringify({
        monthStartYmd: data.monthStartYmd,
        monthEndYmd: data.monthEndYmd,
        rows: data.rows,
        ts: Date.now()
      }));
    } catch {}
  }

  function lsLoad(monthStartYmd) {
    try {
      const raw = localStorage.getItem(lsKey(monthStartYmd));
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (p.monthStartYmd !== monthStartYmd) return null;
      return { ...p, allDayDates: allDayDatesForMonth(monthStartYmd) };
    } catch {
      return null;
    }
  }

  async function buildMonthHierarchyData(offset) {
    const monthStartYmd = monthStartYmdForOffset(offset);
    const monthStart = new Date(monthStartYmd + "T00:00:00");
    const monthEndExclusive = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const monthEndYmd = toYmd(new Date(monthEndExclusive.getTime() - 24 * 60 * 60 * 1000));
    const allDayDates = allDayDatesForMonth(monthStartYmd);
    const allDayKeys = allDayDates.map(toYmd);

    const wiql = `
      SELECT [System.Id] FROM WorkItems
      WHERE [System.AssignedTo] = @Me AND (
        ([Microsoft.VSTS.Scheduling.StartDate] >= '${monthStartYmd}' AND [Microsoft.VSTS.Scheduling.StartDate] < '${toYmd(monthEndExclusive)}')
        OR ([Microsoft.VSTS.Scheduling.FinishDate] >= '${monthStartYmd}' AND [Microsoft.VSTS.Scheduling.FinishDate] < '${toYmd(monthEndExclusive)}')
        OR ([System.ChangedDate] >= '${monthStartYmd}' AND [System.ChangedDate] < '${toYmd(monthEndExclusive)}')
      ) ORDER BY [System.ChangedDate] DESC`.trim();

    const wiqlData = await adoFetchJson(`${ADO_BASE}/wit/wiql?api-version=7.1`, {
      method: "POST",
      body: JSON.stringify({ query: wiql })
    });
    const ids = [...new Set((wiqlData.workItems || []).map((w) => w.id))];
    if (ids.length === 0) return { rows: [], allDayDates, monthStartYmd, monthEndYmd };

    const hierarchyCache = new Map();
    const groupMap = new Map();

    for (const id of ids) {
      const byDay = Object.fromEntries(allDayKeys.map((k) => [k, 0]));
      const commentsData = await adoFetchJson(`${ADO_BASE}/wit/workItems/${id}/comments?api-version=7.1-preview.3`);
      const lhEntries = collectLHEntriesFromComments(commentsData.comments || []);
      const hasTracker = lhEntries.length > 0;

      if (hasTracker) {
        for (const e of lhEntries) {
          if (byDay[e.workDate] == null) continue;
          byDay[e.workDate] += e.hours;
        }
      } else {
        const revData = await adoFetchJson(`${ADO_BASE}/wit/workitems/${id}/revisions?api-version=7.1`);
        const revs = (revData.value || []).slice().sort((a, b) => (a.rev || 0) - (b.rev || 0));
        for (let i = 0; i < revs.length; i++) {
          const cur = revs[i];
          const prev = i > 0 ? revs[i - 1] : null;
          const delta = parseHours(cur?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"]) -
            (prev ? parseHours(prev?.fields?.["Microsoft.VSTS.Scheduling.CompletedWork"]) : 0);
          if (delta <= 0) continue;
          const day = toYmd(new Date(cur?.fields?.["System.ChangedDate"] || 0));
          if (byDay[day] == null) continue;
          byDay[day] += round2(delta);
        }
      }

      const hasHours = allDayKeys.some((k) => Math.abs(byDay[k]) > 1e-9);
      if (!hasHours) continue;

      const hierarchy = await fetchTaskHierarchy(id, hierarchyCache);
      const key = hierarchy.groupKey;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          epicTitle: hierarchy.epicTitle || "Sem Épico",
          title: `${hierarchy.featureTitle || "Sem Feature"} > ${hierarchy.pbiTitle || "Sem PBI"}`,
          byDay: Object.fromEntries(allDayKeys.map((k) => [k, 0])),
          total: 0
        });
      }
      const row = groupMap.get(key);
      for (const k of allDayKeys) row.byDay[k] = round2((row.byDay[k] || 0) + (byDay[k] || 0));
    }

    const rows = [...groupMap.values()].map((r) => ({
      ...r,
      total: round2(allDayKeys.reduce((sum, k) => sum + (r.byDay[k] || 0), 0))
    })).sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "pt-BR", { sensitivity: "base" }));

    return { rows, allDayDates, monthStartYmd, monthEndYmd };
  }

  const btnCss = () => "padding:5px 11px; border:1px solid #ccc; background:#f7f7f7; border-radius:7px; cursor:pointer; font-size:12px;";
  const navBtnCss = () => "padding:5px 12px; border:1px solid #0078d4; background:#fff; color:#0078d4; border-radius:7px; cursor:pointer; font-size:12px;";
  const spinnerCss = "display:inline-block; width:15px; height:15px; border:2px solid #0078d4; border-top-color:transparent;" +
    "border-radius:50%; animation:__lh_monthly_spin 0.7s linear infinite; vertical-align:middle; flex-shrink:0;";

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

    <div style="display:flex; align-items:center; justify-content:space-between;
                padding:10px 16px; border-bottom:1px solid #eee; flex-shrink:0;">
      <span style="font-weight:700; font-size:14px;">
        Relatório Mensal por Hierarquia
        <span style="font-weight:500; color:#64748b; font-size:11px;">build ${BUILD_VERSION}</span>
      </span>
      <div style="display:flex; gap:8px; align-items:center;">
        <button id="lhm-copy-image-btn" style="${btnCss()}" title="Copiar tabela como imagem">📋</button>
        <button id="lhm-refresh-btn" style="${btnCss()}">⟳ Atualizar</button>
        <button id="lhm-close-btn"   style="${btnCss()}">✕ Fechar</button>
      </div>
    </div>

    <div style="display:flex; align-items:center; gap:8px; padding:8px 16px;
                border-bottom:1px solid #eee; flex-shrink:0; background:#fafafa;">
      <button id="lhm-prev-btn" style="${navBtnCss()}">&#8249; Anterior</button>
      <span id="lhm-month-label" style="font-weight:600; min-width:230px; text-align:center;"></span>
      <div style="display:flex; align-items:center; gap:6px;">
        <button id="lhm-next-btn" style="${navBtnCss()}">Próximo &#8250;</button>
        <span id="lhm-spinner" style="${spinnerCss} display:none;"></span>
      </div>
      <div style="margin-left:auto; display:flex; align-items:center; gap:6px;">
        <label style="cursor:pointer; display:flex; align-items:center; gap:5px; font-size:12px;">
          <input type="checkbox" id="lhm-weekend-toggle" style="cursor:pointer;" />
          Mostrar fim de semana
        </label>
      </div>
    </div>

    <div id="lhm-meta" style="padding:4px 16px; color:#888; font-size:11px; flex-shrink:0; min-height:20px;"></div>
    <div id="lhm-content" style="padding:0 16px 16px; overflow:auto; flex:1;"></div>
  </div>
</div>`;
  }

  let monthOffset = (() => {
    try {
      const saved = localStorage.getItem(LS_LAST_MONTH);
      return monthOffsetFromStartYmd(saved);
    } catch {
      return 0;
    }
  })();
  let showWeekends = (() => { try { return localStorage.getItem(LS_WEEKENDS) === "1"; } catch { return false; } })();

  function renderTable({ rows, allDayDates }) {
    const visibleDates = showWeekends ? allDayDates : allDayDates.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    const visibleKeys = visibleDates.map(toYmd);
    const sortedRows = rows.slice().sort((a, b) => {
      const ea = String(a.epicTitle || "Sem Épico");
      const eb = String(b.epicTitle || "Sem Épico");
      const epicCmp = ea.localeCompare(eb, "pt-BR", { sensitivity: "base" });
      if (epicCmp !== 0) return epicCmp;
      return String(a.title || "").localeCompare(String(b.title || ""), "pt-BR", { sensitivity: "base" });
    });

    const table = document.createElement("table");
    table.style.cssText = "width:100%; border-collapse:collapse; font-size:12px;";
    const tdBase = "border:1px solid #ddd; padding:5px 7px;";

    const thead = document.createElement("thead");
    const htr = document.createElement("tr");
    const cols = [
      { label: "Title", align: "left", width: "420px", sticky: true },
      ...visibleDates.map((d) => ({
        label: String(d.getDate()),
        sub: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"][d.getDay()],
        align: "center",
        width: "56px",
        weekend: d.getDay() === 0 || d.getDay() === 6
      })),
      { label: "Total", align: "center", width: "72px" }
    ];
    cols.forEach((col, idx) => {
      const th = document.createElement("th");
      th.innerHTML = col.sub ? `${col.label}<br><span style="font-weight:400;color:#888;">${col.sub}</span>` : col.label;
      th.style.cssText = `position:sticky; top:0; z-index:2; background:${col.weekend ? "#fdf6e3" : "#f3f4f6"}; border:1px solid #ddd; padding:5px 7px; text-align:${col.align}; white-space:nowrap; ${col.width ? `width:${col.width};` : ""}`;
      if (idx === 0 && col.sticky) {
        th.style.left = "0";
        th.style.zIndex = "4";
      }
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    let rowStripeIndex = 0;
    let currentEpic = null;
    let epicByDay = Object.fromEntries(visibleKeys.map((k) => [k, 0]));
    let epicTotal = 0;
    const flushEpicTotalRow = (addSpacer = false) => {
      if (!currentEpic) return;
      const trEpicTotal = document.createElement("tr");
      trEpicTotal.style.cssText = "background:#eef6ff; font-weight:700;";
      const tdEpicLabel = document.createElement("td");
      tdEpicLabel.style.cssText = `${tdBase} position:sticky; left:0; background:#eef6ff; z-index:1; color:#1e3a8a;`;
      tdEpicLabel.textContent = `Total Épico: ${currentEpic}`;
      trEpicTotal.appendChild(tdEpicLabel);
      visibleKeys.forEach((k) => {
        const td = document.createElement("td");
        td.style.cssText = `${tdBase} text-align:center; color:#1e3a8a;`;
        td.textContent = fmt(epicByDay[k]);
        trEpicTotal.appendChild(td);
      });
      const tdEpicTotal = document.createElement("td");
      tdEpicTotal.style.cssText = `${tdBase} text-align:center; color:#1e3a8a;`;
      tdEpicTotal.textContent = fmt(epicTotal);
      trEpicTotal.appendChild(tdEpicTotal);
      tbody.appendChild(trEpicTotal);

      if (addSpacer) {
        const trSpacer = document.createElement("tr");
        const tdSpacer = document.createElement("td");
        tdSpacer.colSpan = visibleKeys.length + 2;
        tdSpacer.style.cssText = `${tdBase} padding:0; height:10px; border-left:1px solid #ddd; border-right:1px solid #ddd; border-top:none; border-bottom:none; background:#fff;`;
        trSpacer.appendChild(tdSpacer);
        tbody.appendChild(trSpacer);
      }
    };

    sortedRows.forEach((r) => {
      if (r.epicTitle !== currentEpic) {
        flushEpicTotalRow(true);
        currentEpic = r.epicTitle || "Sem Épico";
        epicByDay = Object.fromEntries(visibleKeys.map((k) => [k, 0]));
        epicTotal = 0;

        const trEpic = document.createElement("tr");
        trEpic.style.background = "#f8fafc";
        const tdEpic = document.createElement("td");
        tdEpic.colSpan = visibleKeys.length + 2;
        tdEpic.style.cssText = `${tdBase} font-weight:700; color:#334155;`;
        tdEpic.textContent = currentEpic;
        trEpic.appendChild(tdEpic);
        tbody.appendChild(trEpic);
      }

      const tr = document.createElement("tr");
      tr.style.background = rowStripeIndex % 2 === 0 ? "#fff" : "#f9fafb";

      const tdTitle = document.createElement("td");
      tdTitle.style.cssText = `${tdBase} font-weight:600; color:#334155; position:sticky; left:0; background:${rowStripeIndex % 2 === 0 ? "#fff" : "#f9fafb"}; z-index:1; padding-left:18px;`;
      tdTitle.textContent = `↳ ${r.title}`;
      tr.appendChild(tdTitle);

      visibleKeys.forEach((k, i) => {
        const td = document.createElement("td");
        const isWeekend = visibleDates[i].getDay() === 0 || visibleDates[i].getDay() === 6;
        td.style.cssText = `${tdBase} text-align:center;${isWeekend ? " background:#fffbf0;" : ""}`;
        td.textContent = fmt(r.byDay[k]);
        tr.appendChild(td);
      });

      const tdTotal = document.createElement("td");
      tdTotal.style.cssText = `${tdBase} text-align:center; font-weight:700;`;
      const rowTotal = round2(visibleKeys.reduce((sum, k) => sum + (r.byDay[k] || 0), 0));
      tdTotal.textContent = fmt(rowTotal);
      tr.appendChild(tdTotal);

      tbody.appendChild(tr);
      rowStripeIndex++;
      for (const k of visibleKeys) epicByDay[k] = round2((epicByDay[k] || 0) + (r.byDay[k] || 0));
      epicTotal = round2(epicTotal + rowTotal);
    });
    flushEpicTotalRow();

    const grandByDay = Object.fromEntries(visibleKeys.map((k) => [k, 0]));
    for (const r of rows) for (const k of visibleKeys) grandByDay[k] = round2((grandByDay[k] || 0) + (r.byDay[k] || 0));
    const trTotal = document.createElement("tr");
    trTotal.style.cssText = "font-weight:700; background:#f0f4ff;";
    const tdLabel = document.createElement("td");
    tdLabel.style.cssText = `${tdBase} position:sticky; left:0; background:#f0f4ff; z-index:1;`;
    tdLabel.textContent = "Total geral";
    trTotal.appendChild(tdLabel);
    visibleKeys.forEach((k) => {
      const td = document.createElement("td");
      td.style.cssText = `${tdBase} text-align:center;`;
      td.textContent = fmt(grandByDay[k]);
      trTotal.appendChild(td);
    });
    const tdGrand = document.createElement("td");
    tdGrand.style.cssText = `${tdBase} text-align:center;`;
    tdGrand.textContent = fmt(visibleKeys.reduce((sum, k) => sum + (grandByDay[k] || 0), 0));
    trTotal.appendChild(tdGrand);
    tbody.appendChild(trTotal);

    table.appendChild(tbody);
    const wrap = document.createElement("div");
    wrap.style.marginTop = "8px";
    wrap.appendChild(table);
    return wrap;
  }

  async function openModal() {
    const wrap = document.createElement("div");
    wrap.innerHTML = modalHtml();
    document.body.appendChild(wrap.firstElementChild);

    const modal = document.getElementById(MODAL_ID);
    const closeBtn = document.getElementById("lhm-close-btn");
    const copyImageBtn = document.getElementById("lhm-copy-image-btn");
    const refreshBtn = document.getElementById("lhm-refresh-btn");
    const prevBtn = document.getElementById("lhm-prev-btn");
    const nextBtn = document.getElementById("lhm-next-btn");
    const spinner = document.getElementById("lhm-spinner");
    const monthLabel = document.getElementById("lhm-month-label");
    const weekendToggle = document.getElementById("lhm-weekend-toggle");
    const content = document.getElementById("lhm-content");
    const meta = document.getElementById("lhm-meta");

    weekendToggle.checked = showWeekends;
    let cachedData = null;

    const setSpinner = (on) => { spinner.style.display = on ? "inline-block" : "none"; };
    const setNavEnabled = (on) => {
      prevBtn.disabled = !on;
      nextBtn.disabled = !on || monthOffset >= 0;
      refreshBtn.disabled = !on;
      weekendToggle.disabled = !on;
    };

    const updateLabel = (startYmd, endYmd) => {
      const tag = monthOffset === 0 ? " (mês atual)" : monthOffset === -1 ? " (mês passado)" : ` (${Math.abs(monthOffset)}m atrás)`;
      monthLabel.textContent = `${startYmd}  →  ${endYmd}${tag}`;
      nextBtn.disabled = monthOffset >= 0;
      nextBtn.style.opacity = monthOffset >= 0 ? "0.4" : "1";
      try { localStorage.setItem(LS_LAST_MONTH, startYmd); } catch {}
    };

    const loadMonth = async (offset, forceRefresh = false) => {
      const targetYmd = monthStartYmdForOffset(offset);
      const cached = lsLoad(targetYmd);
      setSpinner(true);
      setNavEnabled(false);

      if (cached && !forceRefresh) {
        cachedData = cached;
        updateLabel(cached.monthStartYmd, cached.monthEndYmd);
        content.innerHTML = "";
        content.appendChild(renderTable(cached));
        meta.textContent = `Cache de ${new Date(cached.ts).toLocaleString()} — atualizando…`;
      } else if (!content.firstChild) {
        content.innerHTML = `<div style="padding:12px; color:#666;">Carregando…</div>`;
      }

      try {
        const t0 = performance.now();
        const data = await buildMonthHierarchyData(offset);

        const weekendKeys = data.allDayDates
          .filter((d) => d.getDay() === 0 || d.getDay() === 6)
          .map(toYmd);
        const weekendHours = round2(data.rows.reduce((sum, r) => {
          return sum + weekendKeys.reduce((acc, k) => acc + Number(r?.byDay?.[k] || 0), 0);
        }, 0));
        if (weekendHours > 1e-9 && !showWeekends) {
          showWeekends = true;
          weekendToggle.checked = true;
          try { localStorage.setItem(LS_WEEKENDS, "1"); } catch {}
        }

        cachedData = data;
        lsSave(data);
        updateLabel(data.monthStartYmd, data.monthEndYmd);
        content.innerHTML = "";
        content.appendChild(renderTable(data));
        const t1 = performance.now();

        const grandTotal = round2(data.rows.reduce((s, r) => s + Number(r.total || 0), 0));
        meta.textContent = `Atualizado em ${new Date().toLocaleString()} (${Math.round(t1 - t0)} ms) — ${data.rows.length} hierarquia(s), total ${fmt(grandTotal)}h`;
      } catch (err) {
        if (!cached) {
          content.innerHTML = `<pre style="white-space:pre-wrap; color:#b91c1c; background:#fff1f2; border:1px solid #fecdd3; padding:10px; border-radius:8px;">${String(err?.message || err)}</pre>`;
        }
        meta.textContent = `Erro ao atualizar: ${err?.message || err}`;
      } finally {
        setSpinner(false);
        setNavEnabled(true);
      }
    };

    const isTypingContext = (target) => {
      if (!target) return false;
      const tag = String(target.tagName || "").toUpperCase();
      return tag === "INPUT" || tag === "TEXTAREA" || !!target.isContentEditable;
    };
    const modalHotkeysHandler = (e) => {
      if (!document.getElementById(MODAL_ID)) return;
      if (isTypingContext(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = String(e.key || "").toLowerCase();
      if (key === "arrowleft") {
        e.preventDefault();
        if (!prevBtn.disabled) prevBtn.click();
        return;
      }
      if (key === "arrowright") {
        e.preventDefault();
        if (!nextBtn.disabled) nextBtn.click();
      }
    };
    document.addEventListener("keydown", modalHotkeysHandler);

    const close = () => {
      document.removeEventListener("keydown", modalHotkeysHandler);
      modal?.remove();
    };
    closeBtn.onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    refreshBtn.onclick = () => loadMonth(monthOffset, true);
    copyImageBtn.onclick = async () => {
      try {
        copyImageBtn.disabled = true;
        meta.textContent = "Gerando imagem da tabela...";
        const target = content;
        if (!target) throw new Error("Tabela não encontrada.");
        const canvas = captureElementAsCanvas(target);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("Não foi possível gerar a imagem.");
        if (!navigator.clipboard || !window.ClipboardItem) {
          throw new Error("Clipboard de imagem não suportado neste navegador.");
        }
        await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
        meta.textContent = "Imagem copiada para a área de transferência.";
      } catch (err) {
        meta.textContent = `Erro ao copiar imagem: ${err?.message || err}`;
      } finally {
        copyImageBtn.disabled = false;
      }
    };
    prevBtn.onclick = async () => { monthOffset--; await loadMonth(monthOffset); };
    nextBtn.onclick = async () => { if (monthOffset < 0) { monthOffset++; await loadMonth(monthOffset); } };
    weekendToggle.onchange = () => {
      showWeekends = weekendToggle.checked;
      try { localStorage.setItem(LS_WEEKENDS, showWeekends ? "1" : "0"); } catch {}
      if (cachedData) {
        content.innerHTML = "";
        content.appendChild(renderTable(cachedData));
      }
    };

    await loadMonth(monthOffset);
  }

  const btn = document.createElement("button");
  btn.id = WIDGET_ID;
  btn.title = `Relatório mensal por hierarquia (build ${BUILD_VERSION})`;
  btn.innerText = "📊";
  btn.style.cssText = `
    position:fixed; right:74px; bottom:18px; width:52px; height:52px;
    border-radius:50%; border:1px solid #cbd5e1; background:#0f172a; color:#fff;
    font-size:24px; cursor:pointer; z-index:2147483645;
    box-shadow:0 10px 24px rgba(0,0,0,.28);
  `;
  const triggerOpen = () => { if (!document.getElementById(MODAL_ID)) openModal(); };
  btn.onclick = triggerOpen;
  document.body.appendChild(btn);
  ensureFloatingButtonsHotkeyInstalled();
  applyFloatingButtonsVisibility();

  document.addEventListener("keydown", (e) => {
    if (e.key === KEY_OPEN_MODAL) {
      e.preventDefault();
      const modal = document.getElementById(MODAL_ID);
      if (modal) modal.remove();
      else triggerOpen();
    }
  });
})();
