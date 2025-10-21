// Aggregate all schema pieces here so the rest of the app can do:
//   import { users, posts, stores, ... } from "../db/schema";

export * from "./schema";   // your existing big file (users, posts, products, etc.)
export * from "./stores";   // new stores domain
