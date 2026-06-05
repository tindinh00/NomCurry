export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const envelope = await response.json().catch(() => null);

  if (!response.ok || !envelope?.ok) {
    throw new Error(envelope?.error?.message || "Request failed.");
  }

  return envelope.data as T;
}

