import { requireUser } from '$lib/server/auth/require-user';
import { listBatches } from '$lib/server/nutrition/batch';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
  const user = requireUser(locals);
  const { active, recent } = await listBatches(locals.db, user.id);

  return json(
    { active, recent },
    {
      headers: {
        'Cache-Control': 'private, no-store'
      }
    }
  );
};
