import bcrypt from "bcryptjs";

/** A bcrypt hash. Only `hashPassword` mints one, which is what `storage.createUser` accepts as a password. */
export type PasswordHash = string & { readonly __brand: "PasswordHash" };

export async function hashPassword(plaintext: string): Promise<PasswordHash> {
  return (await bcrypt.hash(plaintext, 10)) as PasswordHash;
}
