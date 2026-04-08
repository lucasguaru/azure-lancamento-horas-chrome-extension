import "../../../scripts/ado-autoparent-create.js";

let loaded = false;

export async function mountAutoparentCreate(): Promise<void> {
  if (loaded) return;
  loaded = true;
}
