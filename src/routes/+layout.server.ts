import { loadInitialTrackerState } from '$lib/server/tracker/initial-state';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, untrack, url }) => {
  // This is initial HTML data, not a route-navigation dependency. Core tracker
  // pages hydrate and refresh the same model from the root-scoped client store.
  const tracker = untrack(() => loadInitialTrackerState(locals, url));

  return {
    theme: locals.theme,
    trackerSessionUserId: locals.user?.id,
    trackerSnapshot: tracker.snapshot,
    trackerEntryFeedback: tracker.entryFeedback
  };
};
