import "../../../scripts/ado-create-task-enhancer.js";

let loaded = false;

export async function mountCreateTaskEnhancer(): Promise<void> {
  if (loaded) return;
  loaded = true;
}
