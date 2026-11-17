import type { User } from "@stylaiize/shared";

/**
 * Returns a client-safe copy of a User. Strips server-only fields such as
 * the password hash so they can never leak to the browser (the Mongoose
 * toJSON transform only runs on documents, not on plain `toUser()` objects
 * that the services/controllers pass directly to `ok()`/`created()`).
 */
export function toPublicUser(user: User): User {
  const copy = { ...user };
  delete copy.passwordHash;
  return copy;
}
