import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import {
  createDatabase,
  type DatabaseConnection
} from '$lib/server/db/connection';
import { nutritionGoals, users } from '$lib/server/db/schema';
import { saveNutritionGoal } from './save-nutrition-goal';

function withMigratedDatabase(
  run: (connection: DatabaseConnection) => void
): void {
  const directory = mkdtempSync(
    join(tmpdir(), 'calories-goals-')
  );
  const connection = createDatabase(
    join(directory, 'test.db')
  );

  try {
    migrate(connection.db, {
      migrationsFolder: 'drizzle'
    });
    run(connection);
  } finally {
    connection.client.close();
    rmSync(directory, {
      recursive: true,
      force: true
    });
  }
}

function insertUser(
  connection: DatabaseConnection,
  email: string
): string {
  return connection.db
    .insert(users)
    .values({
      name: 'Patrick',
      email
    })
    .returning({ id: users.id })
    .get().id;
}

function goalInput(overrides: Record<string, unknown> = {}) {
  return {
    effectiveFrom: '2026-07-12',
    targetEnergyKcal: '2900',
    targetProteinG: '200',
    targetCarbsG: '300',
    targetFatG: '90',
    ...overrides
  };
}

describe('saveNutritionGoal', () => {
  it('inserts a validated goal using fixed-point storage', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(
        connection,
        'patrick@example.com'
      );

      const goal = saveNutritionGoal(
        connection.db,
        userId,
        goalInput()
      );

      expect(goal).toMatchObject({
        userId,
        effectiveFrom: '2026-07-12',
        targetEnergyMkcal: 2_900_000,
        targetProteinMg: 200_000,
        targetCarbsMg: 300_000,
        targetFatMg: 90_000
      });
    });
  });

  it('updates the existing goal for the same user and effective date', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(
        connection,
        'patrick@example.com'
      );
      const original = saveNutritionGoal(
        connection.db,
        userId,
        goalInput()
      );

      const updated = saveNutritionGoal(
        connection.db,
        userId,
        goalInput({
          targetEnergyKcal: '2500.5',
          targetProteinG: '180.25'
        })
      );

      const storedGoals = connection.db
        .select()
        .from(nutritionGoals)
        .where(eq(nutritionGoals.userId, userId))
        .all();

      expect(updated.id).toBe(original.id);
      expect(updated.createdAt).toEqual(original.createdAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        original.updatedAt.getTime()
      );
      expect(updated).toMatchObject({
        targetEnergyMkcal: 2_500_500,
        targetProteinMg: 180_250
      });
      expect(storedGoals).toHaveLength(1);
    });
  });

  it('allows different users to have a goal on the same date', () => {
    withMigratedDatabase((connection) => {
      const firstUserId = insertUser(
        connection,
        'patrick@example.com'
      );
      const secondUserId = insertUser(
        connection,
        'other@example.com'
      );

      const firstGoal = saveNutritionGoal(
        connection.db,
        firstUserId,
        goalInput()
      );
      const secondGoal = saveNutritionGoal(
        connection.db,
        secondUserId,
        goalInput()
      );

      expect(secondGoal.id).not.toBe(firstGoal.id);
      expect(
        connection.db.select().from(nutritionGoals).all()
      ).toHaveLength(2);
    });
  });

  it('does not write anything when validation fails', () => {
    withMigratedDatabase((connection) => {
      const userId = insertUser(
        connection,
        'patrick@example.com'
      );

      expect(() =>
        saveNutritionGoal(
          connection.db,
          userId,
          goalInput({ effectiveFrom: '2026-02-30' })
        )
      ).toThrow();

      expect(
        connection.db.select().from(nutritionGoals).all()
      ).toHaveLength(0);
    });
  });
});
