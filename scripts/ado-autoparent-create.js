(() => {
    const INSTANCE_KEY = "__lh_autoparent_create_instance__";
    if (window[INSTANCE_KEY]) return;
    window[INSTANCE_KEY] = true;

    const PARAM_PARENT = "lh_parent";
    const RUN_KEY_PREFIX = "__lh_autoparent_done__";
    let runInFlight = false;
  
    // Ajuste para true se quiser logs no console durante os testes
    const DEBUG = true;
  
    const log = (...args) => { if (DEBUG) console.log("[LH AutoParent]", ...args); };
  
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  
    const normalize = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
  
    function isCreatePage() {
      // Ex.: /org/project/_workitems/create/Task
      return /\/_workitems\/create\//i.test(location.pathname);
    }
  
    function getParentIdFromUrl() {
      const u = new URL(location.href);
      const raw = u.searchParams.get(PARAM_PARENT);
      if (!raw) return null;
      const id = Number(raw);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
  
    function removeParentParamFromUrl() {
      const u = new URL(location.href);
      if (!u.searchParams.has(PARAM_PARENT)) return;
      u.searchParams.delete(PARAM_PARENT);
      history.replaceState(history.state, "", u.toString());
    }
  
    function runKey(parentId) {
      return `${RUN_KEY_PREFIX}${location.pathname}::${parentId}`;
    }
  
    function alreadyRan(parentId) {
      return sessionStorage.getItem(runKey(parentId)) === "1";
    }
  
    function markRan(parentId) {
      sessionStorage.setItem(runKey(parentId), "1");
    }
  
    function allClickableNodes(root = document) {
      return Array.from(
        root.querySelectorAll(
          "button, a, [role='button'], [role='menuitem'], [role='option'], [aria-label], .bolt-button, .ms-Button"
        )
      );
    }
  
    function findByText(candidates, texts) {
      const wants = texts.map(normalize);
      for (const el of candidates) {
        const txt = normalize(el.textContent || el.getAttribute("aria-label") || "");
        if (!txt) continue;
        if (wants.some((w) => txt.includes(w))) return el;
      }
      return null;
    }
  
    async function waitFor(getter, timeoutMs = 12000, intervalMs = 250) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const val = getter();
        if (val) return val;
        await sleep(intervalMs);
      }
      return null;
    }
  
    async function clickAddExistingParentEntry() {
      log("STEP 1: procurando botão Add link...");
      // 1) tenta abrir menu "Add link"
      const addLinkBtn = await waitFor(() => {
        const nodes = allClickableNodes();
        return findByText(nodes, ["add link", "adicionar link"]);
      }, 10000);
  
      if (!addLinkBtn) throw new Error("Botão 'Add link' não encontrado.");
      addLinkBtn.click();
      log("STEP 1 OK: clicou em Add link");
  
      // 2) seleciona item "Add an existing work item as a parent"
      log("STEP 2: procurando item de menu para parent existente...");
      const addParentItem = await waitFor(() => {
        const nodes = allClickableNodes();
        return findByText(nodes, [
          "add an existing work item as a parent",
          "adicionar um item de trabalho existente como pai",
          "adicionar item existente como pai"
        ]);
      }, 10000);
  
      if (!addParentItem) throw new Error("Opção 'existing work item as a parent' não encontrada.");
      addParentItem.click();
      log("STEP 2 OK: clicou na opção de parent existente");
    }
  
    async function getAddLinkDialog() {
      log("STEP 3: aguardando modal Add link...");
      // Busca modal com título "Add link"/"Adicionar link"
      return waitFor(() => {
        const dialogs = Array.from(document.querySelectorAll("[role='dialog']"));
        for (const d of dialogs) {
          const t = normalize(d.textContent || "");
          if (t.includes("add link") || t.includes("adicionar link")) return d;
        }
        return null;
      }, 10000);
    }
  
    async function ensureLinkTypeParent(dialog) {
      log("STEP 4: garantindo Link type = Parent...");
      // Normalmente já vem "Parent", mas garante.
      const comboCandidates = dialog.querySelectorAll("[role='combobox'], button, input");
      let linkTypeControl = null;
  
      for (const el of comboCandidates) {
        const txt = normalize(el.textContent || el.getAttribute("aria-label") || "");
        if (txt.includes("link type") || txt.includes("tipo de link") || txt.includes("parent") || txt.includes("pai")) {
          linkTypeControl = el;
          break;
        }
      }
  
      if (!linkTypeControl) return; // se não achar, segue: costuma vir correto
      linkTypeControl.click();
      await sleep(200);
  
      const option = await waitFor(() => {
        const nodes = allClickableNodes(document);
        return findByText(nodes, ["parent", "pai"]);
      }, 5000);
  
      if (option) {
        option.click();
        log("Link type ajustado para Parent");
      }
    }
  
    async function fillAndSelectParent(dialog, parentId) {
      log("STEP 5: preenchendo campo de busca com parentId:", parentId);
      // Campo "Work items to link" -> placeholder costuma ser "Search work items by ID or title"
      const input = await waitFor(() => {
        const inputs = Array.from(dialog.querySelectorAll("input, [contenteditable='true']"));
        for (const i of inputs) {
          const ph = normalize(i.getAttribute?.("placeholder") || "");
          const al = normalize(i.getAttribute?.("aria-label") || "");
          const id = normalize(i.id || "");
          const name = normalize(i.getAttribute?.("name") || "");
          const txt = `${ph} ${al} ${id} ${name}`;
          if (
            txt.includes("search work items") ||
            txt.includes("work items to link") ||
            txt.includes("pesquisar itens de trabalho") ||
            txt.includes("itens de trabalho para vincular")
          ) {
            return i;
          }
        }
        return null;
      }, 10000);
  
      if (!input) throw new Error("Campo de busca do parent não encontrado.");
  
      const text = String(parentId);
      input.focus();

      // React/Fluent geralmente usa input controlado; setar `.value` direto nem sempre funciona.
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        const proto = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        if (desc?.set) desc.set.call(input, text);
        else input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        // contenteditable fallback
        input.textContent = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // dispara busca
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
      log("STEP 5 OK: digitou parentId e disparou Enter");
  
      // Aguarda opção no dropdown e clica
      const option = await waitFor(() => {
        const nodes = Array.from(document.querySelectorAll("[role='option'], li, .bolt-list-row"));
        for (const n of nodes) {
          const txt = normalize(n.textContent || "");
          if (txt.includes(String(parentId))) return n;
        }
        return null;
      }, 20000);
  
      if (!option) throw new Error(`Não encontrou opção do parent ${parentId} na lista.`);
      option.click();
      log("STEP 6 OK: selecionou parent na lista");
    }
  
    async function clickAddLinkInDialog(dialog) {
      log("STEP 7: aguardando botão Add link habilitar...");
      const addBtn = await waitFor(() => {
        const nodes = allClickableNodes(dialog);
        const b = findByText(nodes, ["add link", "adicionar link"]);
        if (!b) return null;
        const disabled =
          b.hasAttribute("disabled") ||
          b.getAttribute("aria-disabled") === "true" ||
          b.classList.contains("disabled");
        return disabled ? null : b;
      }, 8000);
  
      if (!addBtn) throw new Error("Botão 'Add link' do modal não habilitou.");
      addBtn.click();
      log("STEP 7 OK: clicou em Add link (modal)");
    }

    async function focusTitleField() {
      log("STEP 8: focando campo Title...");
      const titleInput = await waitFor(() => {
        const byLabel = Array.from(document.querySelectorAll("label[for]")).find((l) => {
          const t = normalize(l.textContent || "");
          return t === "title" || t.includes("title") || t.includes("titulo");
        });
        if (byLabel) {
          const targetId = byLabel.getAttribute("for");
          if (targetId) {
            const byId = document.getElementById(targetId);
            if (byId) return byId;
          }
        }

        const inputs = Array.from(document.querySelectorAll("input, textarea"));
        for (const i of inputs) {
          const txt = normalize(
            `${i.getAttribute?.("aria-label") || ""} ${i.getAttribute?.("placeholder") || ""} ${i.id || ""} ${i.name || ""}`
          );
          if (txt.includes("enter title") || txt.includes("titulo") || txt.includes("title")) return i;
        }
        return null;
      }, 10000);

      if (!titleInput) {
        log("STEP 8 WARN: campo Title não encontrado para foco.");
        return;
      }

      titleInput.click();
      titleInput.focus();
      if (typeof titleInput.setSelectionRange === "function") {
        const len = String(titleInput.value || "").length;
        titleInput.setSelectionRange(len, len);
      }
      log("STEP 8 OK: foco aplicado no campo Title");
    }
  
    async function autoAttachParent(parentId) {
      log("Iniciando auto-parent para ID", parentId);
      await clickAddExistingParentEntry();
  
      const dialog = await getAddLinkDialog();
      if (!dialog) throw new Error("Modal 'Add link' não apareceu.");
  
      await ensureLinkTypeParent(dialog);
      await fillAndSelectParent(dialog, parentId);
      await clickAddLinkInDialog(dialog);
      await sleep(250);
      await focusTitleField();
    }
  
    async function tryRun() {
      if (runInFlight) {
        log("Execução já em andamento, ignorando gatilho duplicado.");
        return;
      }
      runInFlight = true;

      try {
      if (!isCreatePage()) return;
      const parentId = getParentIdFromUrl();
      if (!parentId) return;
  
      if (alreadyRan(parentId)) {
        log("Já executado nesta sessão para este parent.");
        return;
      }
  
      // pequeno atraso para a UI da página montar
      await sleep(500);
  
      try {
        await autoAttachParent(parentId);
        markRan(parentId);
        log("Parent vinculado com sucesso. URL mantida para evitar prompt de Discard changes.");
      } catch (err) {
        console.error("[LH AutoParent] Falha no auto-parent:", err);
        window.__lh_autoparent_last_error = err;
        // Não remove param em falha: facilita retry manual com refresh.
        // Se preferir remover sempre, descomente:
        // removeParentParamFromUrl();
      }
      } finally {
        runInFlight = false;
      }
    }
  
    // --- SPA route watcher (ADO troca de rota sem reload) ---
    let lastHref = location.href;
  
    function scheduleRun() {
      tryRun().catch((e) => log("Erro inesperado:", e?.message || e));
    }
  
    const obs = new MutationObserver(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        scheduleRun();
      }
    });
  
    obs.observe(document.documentElement, { childList: true, subtree: true });
  
    window.addEventListener("popstate", scheduleRun);
    window.addEventListener("hashchange", scheduleRun);
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "complete") scheduleRun();
    });
  
    // primeira execução
    scheduleRun();
  })();