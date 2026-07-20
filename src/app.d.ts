// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Session, Theme, User } from "$lib/server/db/schema";
import type { RequestLogger } from "$lib/server/logging";

// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
      correlationId: string;
      log: RequestLogger;
      user: User | null;
      session: Session | null;
      theme: Theme;
    }
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export { };
