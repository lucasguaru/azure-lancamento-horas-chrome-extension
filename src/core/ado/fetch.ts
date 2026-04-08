export async function adoFetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-TFS-FedAuthRedirect": "Suppress",
      ...(options.headers || {})
    },
    ...options
  });

  if (response.redirected && /\/_signin/i.test(String(response.url || ""))) {
    throw new Error("Sessao do Azure DevOps expirada. Recarregue a pagina e autentique novamente.");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} - ${url}\n${text.slice(0, 500)}`);
  }

  if (response.status === 204) {
    return {} as T;
  }
  return response.json() as Promise<T>;
}
