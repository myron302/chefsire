import { db } from "../db";
import { squareConnections } from "../lib/square-connection";
import { squareCheckoutApi } from "../lib/square-checkout";
import { createCateringSquarePayments } from "./catering-square-payments";

/** The production wiring: the shared database, the Gate 0 provider connections and the real Square SDK. Tests build their own. */
export const cateringSquarePayments = createCateringSquarePayments({ db, connections: squareConnections, checkout: squareCheckoutApi });
