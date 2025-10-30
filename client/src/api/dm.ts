export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "include",
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export async function listThreads() {
  const data = await api<{ ok: boolean; threads: any[] }>(`/dm/threads`);
  return data.threads;
}

export async function getMessages(threadId: string, before?: string, take = 30) {
  const qs = new URLSearchParams();
  if (before) qs.set("before", before);
  if (take) qs.set("take", String(take));
  const data = await api<{ ok: boolean; messages: any[] }>(`/dm/threads/${threadId}/messages?${qs}`);
  return data.messages;
}

export async function createThread(participantIds: string[], title?: string, isGroup?: boolean) {
  const data = await api<{ ok: boolean; threadId: string; reused: boolean }>(`/dm/threads`, {
    method: "POST",
    body: JSON.stringify({ participantIds, title, isGroup }),
  });
  return data.threadId;
}

export async function sendMessage(threadId: string, text: string, attachments?: any[]) {
  const data = await api<{ ok: boolean; message: any }>(`/dm/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text, attachments }),
  });
  return data.message;
}

export async function markRead(threadId: string, lastReadMessageId?: string) {
  return api(`/dm/threads/${threadId}/read`, {
    method: "POST",
    body: JSON.stringify({ lastReadMessageId }),
  });
}
