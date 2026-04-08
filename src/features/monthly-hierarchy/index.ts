import "../../../scripts/ado-monthly-hierarchy-report.js";

let loaded = false;

export async function mountMonthlyHierarchy(): Promise<void> {
  if (loaded) return;
  loaded = true;
}
