import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
  theme: locals.user?.settingsJson.theme ?? 'system'
});
