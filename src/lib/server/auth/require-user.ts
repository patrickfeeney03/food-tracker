import { redirect } from '@sveltejs/kit';
import type { User } from '../db/schema';

export function requireUser(locals: App.Locals): User {
  if (locals.user === null) {
    return redirect(303, '/sign-in');
  }

  return locals.user;
}
