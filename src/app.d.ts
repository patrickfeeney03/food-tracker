// See https://svelte.dev/docs/kit/types#app.d.ts

/// <reference types="vite-plugin-pwa/svelte" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/client" />

import '../worker-configuration';
import type { GoogleAuthConfig } from '$lib/server/auth/google';
import type { Session, Theme, User } from "$lib/server/db/schema";
import type { RequestLogger } from "$lib/server/logging";
import type { AppDatabase } from "$lib/server/db/connection";

// for information about these interfaces
declare global {
  namespace App {
    interface Locals {
      correlationId: string;
      db: AppDatabase;
      log: RequestLogger;
      user: User | null;
      session: Session | null;
      theme: Theme;
    }
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: Omit<Cloudflare.Env, keyof GoogleAuthConfig> & GoogleAuthConfig;
    }
  }
}

export { };
