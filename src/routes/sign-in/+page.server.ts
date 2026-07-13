import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({
  locals,
  url
}) => {
  if (locals.user !== null) {
    return redirect(303, '/');
  }

  const errorCode = url.searchParams.get('error');

  let errorMessage: string | null = null;

  if (errorCode === 'access_denied') {
    errorMessage = 'This Google account is not allowed to access the tracker.';
  } else if (errorCode === 'oauth') {
    errorMessage = 'Google sign-in failed. Please try again.';
  }

  return {
    errorMessage
  };
}
