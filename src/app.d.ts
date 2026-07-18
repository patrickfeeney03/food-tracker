// See https://svelte.dev/docs/kit/types#app.d.ts

import type { Session, Theme, User } from "$lib/server/db/schema";

// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
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
