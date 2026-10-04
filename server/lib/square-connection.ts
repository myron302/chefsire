import { pool } from "../db";
import { createSquareConnectionService, type SqlPool } from "./square-connection-service";
import { squareProviderApi } from "./square-integration";

/** The production wiring: the shared database pool and the real Square SDK. Tests build their own service. */
export const squareConnections = createSquareConnectionService({
  pool: pool as unknown as SqlPool,
  api: squareProviderApi,
});

export const getSquarePaymentReadiness = squareConnections.getSquarePaymentReadiness;
