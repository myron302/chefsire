# Existing TypeScript errors

Command: `npm run check` (`tsc`). Both the pre-change baseline and final check report 3,194 diagnostic headers at identical file/line/column/code locations. No new locations or codes were introduced. Some union-type strings changed ordering nondeterministically; the comparison ignores that ordering.

Representative existing errors include client/src/App.tsx:215 (`TS2322`, route parameter typing), Potent Potables pages' drink-category union mismatches, and shared/schema.ts:370–374 (`TS2300`, duplicate exported identifiers). The complete terminal logs are preserved in the local work directory as `typescript-before.log` and `typescript-final.log`; they are not application assets. `verification.json` preserves the comparison result. The campaign does not fix unrelated TypeScript issues or claim the TypeScript check passes.
