// Square is a CommonJS module - import it properly
import square from "square";
const { Client, Environment } = square;

export function getSquareClient() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("SQUARE_ACCESS_TOKEN not configured");
  }

  return new Client({
    accessToken,
    environment: process.env.NODE_ENV === "production"
      ? Environment.Production
      : Environment.Sandbox,
  });
}

export type SquareClient = ReturnType<typeof getSquareClient>;
