(() => {
  const INSTANCE_KEY = "__lh_create_task_enhancer_instance__";
  if (window[INSTANCE_KEY]) return;
  window[INSTANCE_KEY] = true;

  const PENDING_KEY = "__lh_create_task_enhancer_pending__";
  const APPLIED_KEY_PREFIX = "__lh_create_task_enhancer_applied__";

  const DEBUG = true;
  const log = (...args) => { if (DEBUG) console.log("[LH CreateEnhancer]", ...args); };

  let routeHref = location.href;
  let routeTick = 0;
  let saveCapturedTick = -1;
  let applyingPostSave = false;

  const uiState = {
    mounted: false,
    desiredState: "To Do",
    desiredPriority: 1,
    startDateYmd: toYmd(new Date()),
    originalEstimateBaseAtLoad: null,
    completedBaseAtLoad: null,
    completedDeltaByButtons: 0,
    completedButtonsUsed: false
  };

  const STATE_PRESETS = [
    {
      value: "To Do",
      icon: "📝",
      label: "To Do",
      hint: "Task criada em To Do no Azure."
    },
    {
      value: "In Progress",
      icon: "🚧",
      label: "In Progress",
      hint: "Aplicado automaticamente apos salvar."
    },
    {
      value: "Done",
      icon: "✅",
      label: "Done",
      hint: "Aplicado automaticamente apos salvar."
    }
  ];

  const PRIORITY_PRESETS = [
    { value: 0, icon: "🔥", label: "Urg", hint: "0 - Urgent" },
    { value: 1, icon: "⚡", label: "Hig", hint: "1 - High" },
    { value: 2, icon: "•", label: "Med", hint: "2 - Medium" },
    { value: 3, icon: "↓", label: "Low", hint: "3 - Low" }
  ];

  const HOURS_PRESETS = [0.5, 1, 2, 4, 8];

  function pad2(n) { return String(n).padStart(2, "0"); }
  function toYmd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function nowHm() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function ymdToPtBr(ymd) {
    const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  function parseYmdFromAny(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : toYmd(d);
  }
  function ymdToIsoAtLocalTime(ymd, time) { return new Date(`${ymd}T${time}`).toISOString(); }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

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
      throw new Error("Abra no dominio dev.azure.com/{org}/{project}.");
    }
    return { org, project };
  }

  const { org: ORG, project: PROJECT } = parseOrgProject();
  const ADO_BASE = `https://dev.azure.com/${encodeURIComponent(ORG)}/${encodeURIComponent(PROJECT)}/_apis`;

  function isTaskCreatePage() {
    return /\/_workitems\/create\/task/i.test(location.pathname);
  }

  function getEditTaskIdFromUrl() {
    const m = location.pathname.match(/\/_workitems\/edit\/(\d+)/i);
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isFinite(id) ? id : null;
  }

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseHoursMaybe(v) {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function parseHours(v) {
    return parseHoursMaybe(v) ?? 0;
  }

  function fmtHours(v) {
    const n = Number(v || 0);
    return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  }

  async function adoFetchJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} - ${url}\n${t.slice(0, 500)}`);
    }
    return res.status === 204 ? {} : res.json();
  }

  function allElements(root = document) {
    return Array.from(root.querySelectorAll("input, textarea, [role='combobox'], button, [role='button'], a, [role='menuitem']"));
  }

  function findByLabelCandidates(candidates, includes) {
    const wants = includes.map(norm);
    for (const el of candidates) {
      const text = norm(
        el.getAttribute("aria-label") ||
        el.getAttribute("name") ||
        el.getAttribute("placeholder") ||
        el.textContent ||
        ""
      );
      if (!text) continue;
      if (wants.some((w) => text.includes(w))) return el;
    }
    return null;
  }

  function findLabelByText(texts) {
    const wants = texts.map(norm);
    const labels = Array.from(document.querySelectorAll("label[for]"));
    for (const label of labels) {
      const txt = norm(label.textContent || "");
      if (!txt) continue;
      if (wants.some((w) => txt === w || txt.includes(w))) return label;
    }
    return null;
  }

  function findControlFromLabelText(texts) {
    const label = findLabelByText(texts);
    if (!label) return null;
    const inputId = label.getAttribute("for");
    if (!inputId) return null;
    return document.getElementById(inputId);
  }

  function setReactInputValue(inputEl, value) {
    const next = String(value);
    if (!inputEl) return false;
    if (inputEl.tagName === "INPUT") {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(inputEl, next);
      else inputEl.value = next;
    } else if (inputEl.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(inputEl, next);
      else inputEl.value = next;
    } else {
      inputEl.textContent = next;
    }
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function findCompletedWorkInput() {
    const byLabel = findControlFromLabelText(["completed work", "trabalho concluido"]);
    if (byLabel) return byLabel;
    const els = allElements();
    return findByLabelCandidates(els, ["completed work", "trabalho concluido", "completed-work"]);
  }

  function findOriginalEstimateInput() {
    const byLabel = findControlFromLabelText(["original estimate", "estimativa original"]);
    if (byLabel) return byLabel;
    const els = allElements();
    return findByLabelCandidates(els, ["original estimate", "estimativa original", "original-estimate"]);
  }

  function findStateControl() {
    const byLabel = findControlFromLabelText(["state", "stat e", "estado"]);
    if (byLabel) return byLabel;
    const els = allElements();
    return findByLabelCandidates(els, ["state", "stat e", "estado", "__bolt-stat-e-input"]);
  }

  function findPriorityControl() {
    const byLabel = findControlFromLabelText(["priority", "prioridade"]);
    if (byLabel) return byLabel;
    const els = allElements();
    return findByLabelCandidates(els, ["priority", "prioridade", "__bolt-priority-input"]);
  }

  function findStartDateInput() {
    const byLabel = findControlFromLabelText(["start date", "data inicial"]);
    if (byLabel) return byLabel;
    const all = Array.from(document.querySelectorAll("input, textarea"));
    const dateLike = all.filter((el) => {
      const ph = norm(el.getAttribute("placeholder") || "");
      const al = norm(el.getAttribute("aria-label") || "");
      return ph.includes("select a date")
        || ph.includes("selecione uma data")
        || al.includes("start date")
        || al.includes("data inicial");
    });
    if (dateLike.length > 0) return dateLike[0];
    return null;
  }

  function findFieldBlock(controlEl, labelHints = []) {
    if (!controlEl) return null;
    const byClass = controlEl.closest(".work-item-control, .work-item-form-control, .work-item-form-control-wrapper, .work-item-control-content-wrapper");
    if (byClass) return byClass;
    let node = controlEl;
    const wants = labelHints.map(norm);
    for (let i = 0; i < 7 && node; i++) {
      const txt = norm(node.textContent || "");
      if (wants.length === 0 || wants.some((w) => txt.includes(w))) return node;
      node = node.parentElement;
    }
    return controlEl?.parentElement || null;
  }

  function hideNativeBlock(blockEl) {
    if (!blockEl) return;
    if (blockEl.dataset.lhHiddenByEnhancer === "1") return;
    blockEl.dataset.lhHiddenByEnhancer = "1";
    blockEl.dataset.lhPrevDisplay = blockEl.style.display || "";
    blockEl.style.display = "none";
  }

  function unhideNativeBlock(blockEl) {
    if (!blockEl) return;
    if (blockEl.dataset.lhHiddenByEnhancer !== "1") return;
    const prev = blockEl.dataset.lhPrevDisplay ?? "";
    blockEl.style.display = prev;
    delete blockEl.dataset.lhHiddenByEnhancer;
    delete blockEl.dataset.lhPrevDisplay;
  }

  function restoreHiddenBlocks() {
    const nodes = Array.from(document.querySelectorAll("[data-lh-hidden-by-enhancer='1']"));
    nodes.forEach((el) => {
      const prev = el.dataset.lhPrevDisplay ?? "";
      el.style.display = prev;
      delete el.dataset.lhHiddenByEnhancer;
      delete el.dataset.lhPrevDisplay;
    });
  }

  function isLikelySaveElement(el) {
    if (!el) return false;
    const t = norm(el.textContent || el.getAttribute("aria-label") || "");
    return t === "save" || t === "salvar";
  }

  function readNumberFromInput(inputEl) {
    if (!inputEl) return 0;
    const raw = inputEl.value ?? inputEl.textContent ?? "";
    return parseHours(raw);
  }

  function readCurrentStateText() {
    const stateCtl = findStateControl();
    if (!stateCtl) return "To Do";
    const v = String(stateCtl.value || stateCtl.textContent || "").trim();
    if (!v) return "To Do";
    if (/in progress/i.test(v)) return "In Progress";
    if (/done/i.test(v)) return "Done";
    if (/em andamento/i.test(v)) return "In Progress";
    if (/concluid/i.test(v)) return "Done";
    return "To Do";
  }

  function readCurrentPriority() {
    const p = findPriorityControl();
    const text = String(p?.value || p?.textContent || "");
    const m = text.match(/\d+/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  function ensureInlineReplacement(blockEl, key) {
    if (!blockEl || !blockEl.parentElement) return null;
    const id = `__lh_create_task_inline_${key}__`;
    let repl = document.getElementById(id);
    if (!repl) {
      repl = document.createElement("div");
      repl.id = id;
      repl.dataset.lhCreateInline = "1";
      repl.style.cssText = "margin:4px 0 6px;";

      const body = document.createElement("div");
      body.style.cssText = "display:flex; gap:6px; flex-wrap:wrap; align-items:center;";
      body.dataset.lhInlineBody = "1";
      repl.appendChild(body);

      blockEl.insertAdjacentElement("afterend", repl);
    }
    return repl.querySelector("[data-lh-inline-body='1']");
  }

  function mkSection(title) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-bottom:8px;";

    const h = document.createElement("div");
    h.textContent = title;
    h.style.cssText = "font-weight:700; margin-bottom:5px; color:#334155;";
    wrap.appendChild(h);

    const body = document.createElement("div");
    body.style.cssText = "display:flex; gap:6px; flex-wrap:wrap; align-items:center;";
    wrap.appendChild(body);
    return { wrap, body };
  }

  function mkBtn(text, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText = "padding:4px 8px; border:1px solid #94a3b8; border-radius:999px; background:#fff; color:#0f172a; cursor:pointer; font-size:12px;";
    b.onclick = onClick;
    return b;
  }

  function mkMiniBtn(text, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText = "padding:2px 6px; min-height:22px; border:1px solid #94a3b8; border-radius:999px; background:#fff; color:#0f172a; cursor:pointer; font-size:11px; line-height:1;";
    b.onclick = onClick;
    return b;
  }

  function setPressed(btn, pressed) {
    btn.style.background = pressed ? "#0ea5e9" : "#fff";
    btn.style.color = pressed ? "#fff" : "#0f172a";
    btn.style.borderColor = pressed ? "#0284c7" : "#94a3b8";
  }

  function clearInlineReplacements() {
    const nodes = Array.from(document.querySelectorAll("[data-lh-create-inline='1']"));
    nodes.forEach((n) => n.remove());
  }

  function applyDesiredStateToHiddenField() {
    const stateCtl = findStateControl();
    if (!stateCtl) return;
    setReactInputValue(stateCtl, uiState.desiredState);
  }

  function applyDesiredPriorityToHiddenField() {
    const priCtl = findPriorityControl();
    if (!priCtl) return;
    if (!Number.isFinite(Number(uiState.desiredPriority))) return;
    setReactInputValue(priCtl, String(uiState.desiredPriority));
  }

  function applyStartDateToHiddenField() {
    const startCtl = findStartDateInput();
    if (!startCtl) return;
    const ymd = parseYmdFromAny(uiState.startDateYmd) || toYmd(new Date());
    uiState.startDateYmd = ymd;

    if (String(startCtl.type || "").toLowerCase() === "date") {
      setReactInputValue(startCtl, ymd);
      return;
    }

    // Azure often uses localized text inputs for dates.
    const ptDate = ymdToPtBr(ymd);
    if (ptDate) setReactInputValue(startCtl, ptDate);
  }

  function renderCreateEnhancerInline() {
    if (!isTaskCreatePage()) return;

    clearInlineReplacements();

    const stateCtl = findStateControl();
    const stateBlock = findFieldBlock(stateCtl, ["state", "stat e", "estado"]);
    hideNativeBlock(stateBlock);
    const stateBody = ensureInlineReplacement(stateBlock, "state");
    if (stateBody) {
      applyDesiredStateToHiddenField();
    STATE_PRESETS.forEach((statePreset) => {
      const b = mkBtn(`${statePreset.icon} ${statePreset.label}`, () => {
        uiState.desiredState = statePreset.value;
          applyDesiredStateToHiddenField();
        renderCreateEnhancerInline();
      });
      b.title = statePreset.hint;
      setPressed(b, uiState.desiredState === statePreset.value);
        stateBody.appendChild(b);
    });
    }

    const priCtl = findPriorityControl();
    const priBlock = findFieldBlock(priCtl, ["priority", "prioridade"]);
    hideNativeBlock(priBlock);
    const priBody = ensureInlineReplacement(priBlock, "priority");
    if (priBody) {
      applyDesiredPriorityToHiddenField();
      PRIORITY_PRESETS.forEach((p) => {
        const label = `${p.icon} ${p.label}`;
        const b = mkBtn(label, () => {
          uiState.desiredPriority = p.value;
          applyDesiredPriorityToHiddenField();
          renderCreateEnhancerInline();
        });
        b.title = p.hint;
        setPressed(b, uiState.desiredPriority === p.value);
        priBody.appendChild(b);
      });
    }

    const oeInput = findOriginalEstimateInput();
    const oeBlock = findFieldBlock(oeInput, ["original estimate", "estimativa original"]);
    unhideNativeBlock(oeBlock);
    const oeBody = ensureInlineReplacement(oeBlock, "original-estimate");
    const oeCur = readNumberFromInput(oeInput);
    const oePlusMode = oeCur > 0.0001;
    if (oeBody) {
      HOURS_PRESETS.forEach((n) => {
        const b = mkMiniBtn(`${oePlusMode ? "+" : ""}${n}`, () => {
          const input = findOriginalEstimateInput();
          if (!input) return;
          const cur = readNumberFromInput(input);
          const next = Math.max(0, Number((cur + n).toFixed(2)));
          setReactInputValue(input, fmtHours(next));
          renderCreateEnhancerInline();
        });
        oeBody.appendChild(b);
      });
    }

    const startInput = findStartDateInput();
    const startBlock = findFieldBlock(startInput, ["start date", "data inicial"]);
    unhideNativeBlock(startBlock);
    if (startInput) {
      const cur = String(startInput.value || "").trim();
      if (!cur) {
        applyStartDateToHiddenField();
      } else {
        const parsed = parseYmdFromAny(cur);
        if (parsed) uiState.startDateYmd = parsed;
      }
    }
    const startTimeBody = ensureInlineReplacement(startBlock, "start-time");
    if (startTimeBody) {
      const clock = document.createElement("span");
      clock.textContent = `Agora: ${nowHm()}`;
      clock.style.cssText = "font-size:11px; color:#475569;";
      startTimeBody.appendChild(clock);
    }

    const cwInput = findCompletedWorkInput();
    const cwBlock = findFieldBlock(cwInput, ["completed work", "trabalho concluido"]);
    unhideNativeBlock(cwBlock);
    const cwBody = ensureInlineReplacement(cwBlock, "completed-work");
    const cwCur = readNumberFromInput(cwInput);
    const isPlusMode = cwCur > 0.0001;

    if (cwBody) {
      HOURS_PRESETS.forEach((n) => {
        const label = `${isPlusMode ? "+" : ""}${n}`;
        const b = mkMiniBtn(label, () => {
          const input = findCompletedWorkInput();
          if (!input) return;
          const cur = readNumberFromInput(input);
          const next = Math.max(0, Number((cur + n).toFixed(2)));
          setReactInputValue(input, fmtHours(next));
          uiState.completedButtonsUsed = true;
          uiState.completedDeltaByButtons = Number((uiState.completedDeltaByButtons + n).toFixed(2));
          renderCreateEnhancerInline();
        });
        cwBody.appendChild(b);
      });
    }
  }

  function forceStateToToDoBeforeSave() {
    const stateCtl = findStateControl();
    if (!stateCtl) return;
    setReactInputValue(stateCtl, "To Do");
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
    const t = String(line || "").trim();
    if (!t.startsWith("LH|")) return null;
    const obj = {};
    t.slice(3).split("|").forEach((p) => {
      const i = p.indexOf("=");
      if (i > 0) obj[p.slice(0, i)] = p.slice(i + 1);
    });
    if (!obj.work_date || obj.hours == null) return null;
    const h = parseHoursMaybe(obj.hours);
    if (!Number.isFinite(h)) return null;
    return { workDate: obj.work_date, hours: h };
  }

  function parseLHTracker(commentText) {
    const plain = normalizeCommentText(commentText);
    if (!plain.startsWith("LH|")) return null;
    return plain.split(/\r?\n/).map(parseLHLine).filter(Boolean);
  }

  async function upsertLHTrackerComment(taskId, workDateYmd, deltaHours) {
    if (!(deltaHours > 0)) return;
    const commentsData = await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments?api-version=7.1-preview.3`);
    const tracker = (commentsData.comments || []).find((c) => normalizeCommentText(c.text).startsWith("LH|"));
    const entries = tracker ? (parseLHTracker(tracker.text) || []) : [];

    const idx = entries.findIndex((e) => e.workDate === workDateYmd);
    if (idx >= 0) entries[idx].hours = Number((entries[idx].hours + deltaHours).toFixed(2));
    else entries.push({ workDate: workDateYmd, hours: Number(deltaHours.toFixed(2)) });

    const sorted = entries.sort((a, b) => a.workDate.localeCompare(b.workDate));
    const text = sorted
      .map((e) => `LH|work_date=${e.workDate}|hours=${fmtHours(e.hours)}|task_id=${taskId}|desc=create-enhancer`)
      .join("\n");

    if (tracker) {
      await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments/${tracker.id}?api-version=7.1-preview.3`, {
        method: "PATCH",
        body: JSON.stringify({ text })
      });
    } else {
      await adoFetchJson(`${ADO_BASE}/wit/workItems/${taskId}/comments?api-version=7.1-preview.3`, {
        method: "POST",
        body: JSON.stringify({ text })
      });
    }
  }

  function pendingPayload() {
    const completedInput = findCompletedWorkInput();
    const completedNow = readNumberFromInput(completedInput);
    const base = Number.isFinite(uiState.completedBaseAtLoad) ? uiState.completedBaseAtLoad : 0;
    const fallbackDelta = Math.max(0, Number((completedNow - base).toFixed(2)));
    const delta = uiState.completedButtonsUsed
      ? Number(uiState.completedDeltaByButtons.toFixed(2))
      : fallbackDelta;

    return {
      createdAt: Date.now(),
      desiredState: uiState.desiredState,
      desiredPriority: uiState.desiredPriority,
      startDateYmd: uiState.startDateYmd,
      workDateYmd: toYmd(new Date()),
      completedDelta: delta
    };
  }

  function capturePendingBeforeSave() {
    if (!isTaskCreatePage()) return;
    if (saveCapturedTick === routeTick) return;
    saveCapturedTick = routeTick;

    forceStateToToDoBeforeSave();
    const payload = pendingPayload();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    log("Pending salvo para pos-save:", payload);
  }

  function loadPending() {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearPending() {
    sessionStorage.removeItem(PENDING_KEY);
  }

  async function applyPostSaveIfNeeded() {
    if (applyingPostSave) return;
    const taskId = getEditTaskIdFromUrl();
    if (!taskId) return;

    const pending = loadPending();
    if (!pending) return;

    if (Date.now() - Number(pending.createdAt || 0) > 15 * 60 * 1000) {
      clearPending();
      return;
    }

    const appliedKey = `${APPLIED_KEY_PREFIX}${taskId}`;
    if (sessionStorage.getItem(appliedKey) === "1") return;

    applyingPostSave = true;
    try {
      const wi = await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`);
      const fields = wi?.fields || {};
      const patchOps = [];

      const desiredState = String(pending.desiredState || "To Do");
      const desiredPriority = pending.desiredPriority;
      const startDateYmd = String(pending.startDateYmd || toYmd(new Date()));

      if (Number.isFinite(Number(desiredPriority))) {
        patchOps.push({
          op: fields["Microsoft.VSTS.Common.Priority"] == null ? "add" : "replace",
          path: "/fields/Microsoft.VSTS.Common.Priority",
          value: Number(desiredPriority)
        });
      }

      const curStart = fields["Microsoft.VSTS.Scheduling.StartDate"];
      if (!curStart && startDateYmd) {
        patchOps.push({
          op: fields["Microsoft.VSTS.Scheduling.StartDate"] == null ? "add" : "replace",
          path: "/fields/Microsoft.VSTS.Scheduling.StartDate",
          value: ymdToIsoAtLocalTime(startDateYmd, "00:00:00")
        });
      }

      if (desiredState === "In Progress") {
        patchOps.push({
          op: fields["System.State"] == null ? "add" : "replace",
          path: "/fields/System.State",
          value: "In Progress"
        });
      } else if (desiredState === "Done") {
        patchOps.push({
          op: fields["System.State"] == null ? "add" : "replace",
          path: "/fields/System.State",
          value: "Done"
        });
        patchOps.push({
          op: fields["Microsoft.VSTS.Scheduling.FinishDate"] == null ? "add" : "replace",
          path: "/fields/Microsoft.VSTS.Scheduling.FinishDate",
          value: ymdToIsoAtLocalTime(startDateYmd, "23:59:00")
        });
      }

      if (patchOps.length > 0) {
        await adoFetchJson(`${ADO_BASE}/wit/workitems/${taskId}?api-version=7.1`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json-patch+json" },
          body: JSON.stringify(patchOps)
        });
      }

      if (Number(pending.completedDelta || 0) > 0) {
        await upsertLHTrackerComment(taskId, String(pending.workDateYmd || toYmd(new Date())), Number(pending.completedDelta));
      }

      sessionStorage.setItem(appliedKey, "1");
      clearPending();
      log("Pos-save aplicado com sucesso na task", taskId);
    } catch (err) {
      console.error("[LH CreateEnhancer] Falha no pos-save:", err);
      window.__lh_create_enhancer_last_error = err;
    } finally {
      applyingPostSave = false;
    }
  }

  function attachSaveCaptureHooks() {
    document.addEventListener("click", (e) => {
      const el = e.target?.closest?.("button, [role='button'], [role='menuitem'], a");
      if (!el) return;
      if (!isLikelySaveElement(el)) return;
      capturePendingBeforeSave();
    }, true);

    document.addEventListener("keydown", (e) => {
      const key = String(e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "s") {
        capturePendingBeforeSave();
      }
    }, true);
  }

  function bootstrapCreateUi() {
    if (!isTaskCreatePage()) {
      clearInlineReplacements();
      restoreHiddenBlocks();
      uiState.mounted = false;
      return;
    }

    if (!uiState.mounted) {
      uiState.desiredState = readCurrentStateText();
      uiState.desiredPriority = 1;
      const originalEstimate = findOriginalEstimateInput();
      uiState.originalEstimateBaseAtLoad = readNumberFromInput(originalEstimate);
      const completed = findCompletedWorkInput();
      uiState.completedBaseAtLoad = readNumberFromInput(completed);
      uiState.completedButtonsUsed = false;
      uiState.completedDeltaByButtons = 0;
      uiState.mounted = true;
    }

    renderCreateEnhancerInline();
  }

  async function onRouteChange() {
    routeTick += 1;
    await sleep(120);
    bootstrapCreateUi();
    await applyPostSaveIfNeeded();
  }

  function boot() {
    attachSaveCaptureHooks();
    onRouteChange().catch((err) => console.error("[LH CreateEnhancer] boot route error:", err));

    const obs = new MutationObserver(() => {
      if (location.href !== routeHref) {
        routeHref = location.href;
        onRouteChange().catch((err) => console.error("[LH CreateEnhancer] route error:", err));
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener("popstate", () => onRouteChange().catch(() => {}));
    window.addEventListener("hashchange", () => onRouteChange().catch(() => {}));

    setInterval(() => {
      if (isTaskCreatePage()) renderCreateEnhancerInline();
    }, 1500);
  }

  boot();
})();
