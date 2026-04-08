export type AdoContext = {
  org: string;
  project: string;
  apiBase: string;
};

export function parseAdoContextFromLocation(loc: Location = window.location): AdoContext {
  const parts = loc.pathname.split("/").filter(Boolean);
  if (loc.hostname !== "dev.azure.com" || parts.length < 2) {
    throw new Error("Abra no dominio dev.azure.com/{org}/{project}.");
  }

  const org = decodeURIComponent(parts[0]);
  const project = decodeURIComponent(parts[1]);
  const apiBase = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis`;
  return { org, project, apiBase };
}
