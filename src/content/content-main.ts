import { bootRouter } from "./router";

const GLOBAL_KEY = "__chrome_ado_hours_booted__";

function boot(): void {
  const globalState = window as unknown as Record<string, unknown>;
  if (globalState[GLOBAL_KEY]) return;
  globalState[GLOBAL_KEY] = true;
  bootRouter();
}

boot();
