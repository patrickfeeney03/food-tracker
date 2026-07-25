import { logFoodInputSchema } from '$lib/nutrition/portion-input';
import { requireUser } from '$lib/server/auth/require-user';
import { db } from '$lib/server/db';
import {
  ExistingFoodLogConflictError,
  ExistingFoodNotFoundError,
  logExistingFood
} from '$lib/server/nutrition/log-existing-food';
import { buildOfflineBootstrap } from '$lib/server/offline/bootstrap';
import { json, type RequestHandler } from '@sveltejs/kit';
import z from 'zod';

const queuedDiaryLogSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('log-existing-food'),
  userId: z.uuid(),
  foodId: z.uuid(),
  input: logFoodInputSchema
});

function noStoreJson(
  body: unknown,
  status = 200
): Response {
  return json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store'
    }
  });
}

export const POST: RequestHandler = async ({
  locals,
  request
}) => {
  const user = requireUser(locals);
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return noStoreJson({
      message: 'Invalid JSON request body.'
    }, 400);
  }

  const payload = queuedDiaryLogSchema.safeParse(body);

  if (!payload.success) {
    return noStoreJson({
      message: 'Invalid queued diary log.'
    }, 400);
  }

  if (payload.data.userId !== user.id) {
    return noStoreJson({
      message: 'Queued change belongs to a different user.'
    }, 403);
  }

  try {
    logExistingFood(
      db,
      user.id,
      payload.data.foodId,
      payload.data.input
    );

    return noStoreJson({
      schemaVersion: 1,
      acknowledgedMutationId:
        payload.data.input.clientMutationId,
      bootstrap: buildOfflineBootstrap(
        db,
        user,
        payload.data.input.diaryDate
      )
    });
  } catch (caught) {
    if (caught instanceof ExistingFoodNotFoundError) {
      return noStoreJson({
        message: caught.message
      }, 404);
    }

    if (caught instanceof ExistingFoodLogConflictError) {
      return noStoreJson({
        message: caught.message
      }, 409);
    }

    if (caught instanceof RangeError) {
      return noStoreJson({
        message: caught.message
      }, 400);
    }

    throw caught;
  }
};
