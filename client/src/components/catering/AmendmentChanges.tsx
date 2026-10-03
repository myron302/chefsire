import { describeCateringAmendmentChanges, type CateringAmendmentView } from "@shared/catering-amendments";

/**
 * The changed terms of one amendment as OLD -> NEW text, one row per changed term. It is the only rendering of a change, so the
 * pending panel, the accept / decline dialog and the history show the same words to both participants. The change is in the text
 * itself, never in colour.
 */
export function AmendmentChanges({ amendment }: { amendment: Pick<CateringAmendmentView, "changedFields" | "before" | "after"> }) {
  const changes = describeCateringAmendmentChanges(amendment);
  return (
    <ul className="space-y-1 text-sm" aria-label="Proposed changes">
      {changes.map((change) => (
        <li key={change.field} className="break-words"><span className="font-medium">{change.label}:</span> <span className="whitespace-pre-wrap">{change.before}</span> <span aria-label="changes to">→</span> <span className="whitespace-pre-wrap font-medium">{change.after}</span></li>
      ))}
    </ul>
  );
}
