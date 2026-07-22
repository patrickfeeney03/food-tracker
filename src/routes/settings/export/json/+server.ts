import { todayInDublin } from '$lib/date';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import {
  buildPortableDataExport,
  dataExportResponse
} from '$lib/server/export/data-export';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
  const user = requireUser(locals);
  const exportedAt = new Date();
  const data = buildPortableDataExport(db, user.id, exportedAt);

  locals.log.info('user.data_exported', {
    format: 'json',
    foodCount: data.foods.length,
    diaryEntryCount: data.diaryEntries.length,
    mealShortcutCount: data.mealShortcuts.length
  });

  return dataExportResponse(
    `${JSON.stringify(data, null, 2)}\n`,
    'application/json; charset=utf-8',
    `calorie-tracker-data-${todayInDublin()}.json`
  );
};
