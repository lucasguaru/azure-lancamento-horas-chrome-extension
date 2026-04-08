type Callback = () => void;

export function onSpaLocationChange(callback: Callback): () => void {
  let lastHref = location.href;
  let timer: number | null = null;

  const emitIfChanged = () => {
    if (lastHref === location.href) return;
    lastHref = location.href;
    callback();
  };

  const wrap = <T extends (...args: never[]) => unknown>(fn: T): T => {
    return ((...args: never[]) => {
      const out = fn(...args);
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(emitIfChanged, 0);
      return out;
    }) as T;
  };

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = wrap(originalPushState);
  history.replaceState = wrap(originalReplaceState);

  const onPopState = () => emitIfChanged();
  window.addEventListener("popstate", onPopState);

  const observer = new MutationObserver(() => emitIfChanged());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", onPopState);
    observer.disconnect();
    if (timer !== null) window.clearTimeout(timer);
  };
}
