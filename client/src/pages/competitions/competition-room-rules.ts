/**
 * What the competition room may offer, mirroring server/routes/competitions.ts exactly:
 * - POST /:id/submit  accepts only `live` or `judging`.
 * - POST /:id/votes   accepts only `live` or `judging`, and refuses participants.
 * - POST /:id/start   upcoming -> live;  /end  live -> judging;  /complete  judging -> completed (host only).
 * Keep these in lockstep with the server; competition-room-rules.test.ts pins them.
 */
export const SUBMIT_STATUSES: readonly string[] = ['live', 'judging'];
export const VOTE_STATUSES: readonly string[] = ['live', 'judging'];

export type RoomContext = {
  status: string;
  signedIn: boolean;
  isHost: boolean;
  hasEntry: boolean;
  competitorCount: number;
};

export type HostAction = { endpoint: 'start' | 'end' | 'complete'; label: string; success: string };

export function hostAction(status: string): HostAction | null {
  if (status === 'upcoming') return { endpoint: 'start', label: 'Start Battle', success: 'The battle is live!' };
  if (status === 'live') return { endpoint: 'end', label: 'End Cooking & Start Judging', success: 'Judging is open.' };
  if (status === 'judging') return { endpoint: 'complete', label: 'Finalize Results', success: 'Results are final.' };
  return null;
}

export function roomAffordances(ctx: RoomContext) {
  const submissionsOpen = SUBMIT_STATUSES.includes(ctx.status);
  const votingOpen = VOTE_STATUSES.includes(ctx.status);
  return {
    /** Show the join / submit-dish form. */
    canSubmit: ctx.signedIn && !ctx.isHost && submissionsOpen,
    /** Signed-out visitor while entries are open: prompt to sign in. */
    promptSignInToCompete: !ctx.signedIn && submissionsOpen,
    /** Upcoming battle, not the host: explain that entries open when the host starts. */
    waitingForHost: !ctx.isHost && ctx.status === 'upcoming',
    canVote: ctx.signedIn && !ctx.hasEntry && votingOpen && ctx.competitorCount > 0,
    promptSignInToVote: !ctx.signedIn && votingOpen && ctx.competitorCount > 0,
    hostAction: ctx.isHost ? hostAction(ctx.status) : null,
  };
}
