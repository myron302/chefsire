import { db } from "../db";
import { squareConnections } from "../lib/square-connection";
import { squareCheckoutApi } from "../lib/square-checkout";
import { createCateringSquarePayments } from "./catering-square-payments";

/** The production wiring: the shared database, the Gate 0 provider connections and the real Square SDK. Tests build their own. */
export const cateringSquarePayments = createCateringSquarePayments({ db, connections: squareConnections, checkout: squareCheckoutApi });

// Before the provider's Square credential is discarded (a disconnect) or replaced by another merchant's, every open checkout made with it is
// wound down while it still works. Registered here because this module is where the connection and the payments meet.
squareConnections.setCredentialDiscardGuard(({ userId }) => cateringSquarePayments.closeProviderCheckouts(userId), (context) => cateringSquarePayments.credentialStillNeeded(context));
