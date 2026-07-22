import { todayInDublin } from '$lib/date';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import {
  buildDiaryCsvExport,
  dataExportResponse
} from '$lib/server/export/data-export';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
  const user = requireUser(locals);
  const exportResult = buildDiaryCsvExport(db, user.id);

  locals.log.info('user.data_exported', {
    format: 'csv',
    diaryEntryCount: exportResult.diaryEntryCount
  });

  return dataExportResponse(
    exportResult.content,
    'text/csv; charset=utf-8',
    `calorie-tracker-diary-${todayInDublin()}.csv`
  );
};
