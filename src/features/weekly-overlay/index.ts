import "../../../scripts/ado-weekly-hours-overlay.js";

let loaded = false;

export async function mountWeeklyOverlay(): Promise<void> {
  if (loaded) return;
  loaded = true;
}
