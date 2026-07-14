export type PersistedCampaign = {
  campaignId: string;
  status: 'saved' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
};

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Campaign request failed (${response.status})`);
  return payload;
}

export async function fetchCampaignState(): Promise<{ savedCampaigns: PersistedCampaign[]; activeCampaign: PersistedCampaign | null }> {
  return readJson(await fetch('/api/meal-planner/campaigns/state', { credentials: 'include' }));
}

export async function saveCampaign(campaignId: string): Promise<PersistedCampaign> {
  const payload = await readJson(await fetch('/api/meal-planner/campaigns/saved', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId }),
  }));
  return payload.savedCampaign;
}

export async function unsaveCampaign(campaignId: string): Promise<void> {
  await readJson(await fetch(`/api/meal-planner/campaigns/saved/${encodeURIComponent(campaignId)}`, { method: 'DELETE', credentials: 'include' }));
}

export async function startCampaign(campaignId: string): Promise<PersistedCampaign> {
  const payload = await readJson(await fetch('/api/meal-planner/campaigns/active', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignId }),
  }));
  return payload.activeCampaign;
}

export async function completeActiveCampaign(): Promise<{ completedCampaign: PersistedCampaign | null }> {
  return readJson(await fetch('/api/meal-planner/campaigns/active/complete', {
    method: 'POST',
    credentials: 'include',
  }));
}
