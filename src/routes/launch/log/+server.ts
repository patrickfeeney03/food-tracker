import { resolve } from '$app/paths';
import { todayInDublin } from '$lib/date';
import { withQuery } from '$lib/navigation';
import { destinationSchema } from '$lib/nutrition/navigation-context';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
  const destination = destinationSchema.safeParse({
    date: todayInDublin(),
    mealSlot: url.searchParams.get('mealSlot')
  });

  if (!destination.success) {
    return error(400, 'Invalid launcher destination');
  }

  return redirect(303, resolve(withQuery('/foods', destination.data)));
};
