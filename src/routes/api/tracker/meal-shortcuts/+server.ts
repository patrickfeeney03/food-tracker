import { requireUser } from '$lib/server/auth/require-user';
import { listMealShortcuts } from '$lib/server/nutrition/meal-shortcut';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
  const user = requireUser(locals);
  const shortcuts = (await listMealShortcuts(locals.db, user.id, '', 50)).map((shortcut) => ({
    id: shortcut.id,
    name: shortcut.name,
    itemCount: shortcut.itemCount,
    blocked: shortcut.blocked,
    energyMkcal: shortcut.totals?.energyMkcal ?? null
  }));

  return json(
    { shortcuts },
    {
      headers: {
        'Cache-Control': 'private, no-store'
      }
    }
  );
};
