import { amountUnits, mealSlots, portionKinds } from '$lib/nutrition/constants';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

export const authProviders = ['google'] as const;
export const themes = ['light', 'dark', 'system'] as const;

export type AuthProvider = (typeof authProviders)[number];
export type Theme = (typeof themes)[number];

export interface UserSettings {
  theme?: Theme;
}

export interface AdditionalNutrition {
  fibreMg?: number;
  sugarMg?: number;
  saturatedFatMg?: number;
  sodiumMg?: number;
  potassiumMg?: number;
}

function sqlStringList(values: readonly [string, ...string[]]) {
  return sql.raw(values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', '));
}

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

const deletedAt = () => integer('deleted_at', { mode: 'timestamp_ms' });

export const users = sqliteTable('users', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  settingsJson: text('settings_json', { mode: 'json' })
    .$type<UserSettings>()
    .notNull()
    .default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});

export const authAccounts = sqliteTable(
  'auth_accounts',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: authProviders }).notNull().default(authProviders[0]),
    providerSubject: text('provider_subject').notNull(),
    emailAtLink: text('email_at_link').notNull(),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex('auth_accounts_provider_subject_unique').on( // A Google acc can belong to at most one system user
      table.provider,
      table.providerSubject
    ),
    uniqueIndex('auth_accounts_user_provider_unique').on(table.userId, table.provider), // A system user can have at most one Google account linked.
    check(
      'auth_accounts_provider_check',
      sql`${table.provider} in (${sqlStringList(authProviders)})`
    ) // verify that provider is supported on each write a.k.a Google
  ]
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: createdAt(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    userAgent: text('user_agent')
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_revoked_expires_idx').on(
      table.userId,
      table.revokedAt,
      table.expiresAt
    )
  ]
);

export const nutritionGoals = sqliteTable(
  'nutrition_goals',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    effectiveFrom: text('effective_from').notNull(),
    targetEnergyMkcal: integer('target_energy_mkcal').notNull(),
    targetProteinMg: integer('target_protein_mg').notNull(),
    targetCarbsMg: integer('target_carbs_mg').notNull(),
    targetFatMg: integer('target_fat_mg').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (table) => [
    uniqueIndex('nutrition_goals_user_effective_from_unique').on(
      table.userId,
      table.effectiveFrom
    ),
    index('nutrition_goals_user_effective_from_idx').on(
      table.userId,
      table.effectiveFrom
    ),
    check( // date format checker
      'nutrition_goals_effective_from_check',
      sql`length(${table.effectiveFrom}) = 10 and ${table.effectiveFrom} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`
    ),
    check(
      'nutrition_goals_targets_non_negative_check',
      sql`${table.targetEnergyMkcal} >= 0 and ${table.targetProteinMg} >= 0 and ${table.targetCarbsMg} >= 0 and ${table.targetFatMg} >= 0`
    )
  ]
);

export const foods = sqliteTable(
  'foods',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    brand: text('brand'),
    barcode: text('barcode'),
    amountUnit: text('amount_unit', { enum: amountUnits }).notNull(),
    basisAmount: integer('basis_amount').notNull(),
    servingAmount: integer('serving_amount'),
    containerAmount: integer('container_amount'),
    energyMkcalPerBasis: integer('energy_mkcal_per_basis').notNull(),
    proteinMgPerBasis: integer('protein_mg_per_basis').notNull(),
    carbsMgPerBasis: integer('carbs_mg_per_basis').notNull(),
    fatMgPerBasis: integer('fat_mg_per_basis').notNull(),
    additionalNutritionJson: text('additional_nutrition_json', { mode: 'json' }).$type<AdditionalNutrition>(),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt()
  },
  (table) => [
    index('foods_user_active_name_idx').on(table.userId, table.deletedAt, table.name),
    index('foods_user_active_brand_idx').on(table.userId, table.deletedAt, table.brand),
    uniqueIndex('foods_user_active_barcode_unique')
      .on(table.userId, table.barcode)
      .where(sql`${table.barcode} is not null and ${table.deletedAt} is null`),
    check('foods_amount_unit_check', sql`${table.amountUnit} in (${sqlStringList(amountUnits)})`),
    check('foods_basis_amount_positive_check', sql`${table.basisAmount} > 0`),
    check(
      'foods_optional_amounts_positive_check',
      sql`(${table.servingAmount} is null or ${table.servingAmount} > 0) and (${table.containerAmount} is null or ${table.containerAmount} > 0)`
    ),
    check(
      'foods_core_nutrition_non_negative_check',
      sql`${table.energyMkcalPerBasis} >= 0 and ${table.proteinMgPerBasis} >= 0 and ${table.carbsMgPerBasis} >= 0 and ${table.fatMgPerBasis} >= 0`
    )
  ]
);

export const mealShortcuts = sqliteTable(
  'meal_shortcuts',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt()
  },
  (table) => [index('meal_shortcuts_user_active_name_idx').on(table.userId, table.deletedAt, table.name)]
);

export const mealShortcutItems = sqliteTable(
  'meal_shortcut_items',
  {
    id: id(),
    shortcutId: text('shortcut_id')
      .notNull()
      .references(() => mealShortcuts.id, { onDelete: 'cascade' }),
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id),
    position: integer('position').notNull(),
    defaultAmount: integer('default_amount').notNull(),
    defaultPortionKind: text('default_portion_kind', { enum: portionKinds }),
    defaultPortionLabel: text('default_portion_label'),
    defaultPortionAmount: integer('default_portion_amount'),
    defaultPortionCountMilli: integer('default_portion_count_milli')
  },
  (table) => [
    uniqueIndex('meal_shortcut_items_shortcut_position_unique').on(
      table.shortcutId,
      table.position
    ),
    index('meal_shortcut_items_food_idx').on(table.foodId),
    check('meal_shortcut_items_position_non_negative_check', sql`${table.position} >= 0`),
    check('meal_shortcut_items_default_amount_positive_check', sql`${table.defaultAmount} > 0`),
    check(
      'meal_shortcut_items_portion_kind_check',
      sql`${table.defaultPortionKind} is null or ${table.defaultPortionKind} in (${sqlStringList(portionKinds)})`
    ),
    check(
      'meal_shortcut_items_portion_snapshot_check',
      sql`(${table.defaultPortionKind} is null and ${table.defaultPortionLabel} is null and ${table.defaultPortionAmount} is null and ${table.defaultPortionCountMilli} is null) or (${table.defaultPortionKind} is not null and ${table.defaultPortionLabel} is not null and ${table.defaultPortionAmount} is not null and ${table.defaultPortionAmount} > 0 and ${table.defaultPortionCountMilli} is not null and ${table.defaultPortionCountMilli} > 0)`
    )
  ]
);

export const diaryLogs = sqliteTable(
  'diary_logs',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    foodId: text('food_id').references(() => foods.id, { onDelete: 'set null' }),
    diaryDate: text('diary_date').notNull(),
    mealSlot: text('meal_slot', { enum: mealSlots }).notNull(),
    sourceShortcutId: text('source_shortcut_id').references(() => mealShortcuts.id, {
      onDelete: 'set null'
    }),
    shortcutBatchId: text('shortcut_batch_id'),
    clientMutationId: text('client_mutation_id'),

    foodName: text('food_name').notNull(),
    foodBrand: text('food_brand'),
    amountUnit: text('amount_unit', { enum: amountUnits }).notNull(),
    basisAmount: integer('basis_amount').notNull(),
    energyMkcalPerBasis: integer('energy_mkcal_per_basis').notNull(),
    proteinMgPerBasis: integer('protein_mg_per_basis').notNull(),
    carbsMgPerBasis: integer('carbs_mg_per_basis').notNull(),
    fatMgPerBasis: integer('fat_mg_per_basis').notNull(),
    additionalNutritionPerBasisJson: text('additional_nutrition_per_basis_json', {
      mode: 'json'
    }).$type<AdditionalNutrition>(),

    portionKind: text('portion_kind', { enum: portionKinds }).notNull(),
    portionLabel: text('portion_label').notNull(),
    portionAmount: integer('portion_amount').notNull(),
    portionCountMilli: integer('portion_count_milli').notNull(),
    resolvedAmount: integer('resolved_amount').notNull(),

    energyMkcal: integer('energy_mkcal').notNull(),
    proteinMg: integer('protein_mg').notNull(),
    carbsMg: integer('carbs_mg').notNull(),
    fatMg: integer('fat_mg').notNull(),
    additionalNutritionTotalJson: text('additional_nutrition_total_json', {
      mode: 'json'
    }).$type<AdditionalNutrition>(),

    loggedAt: integer('logged_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt()
  },
  (table) => [
    uniqueIndex('diary_logs_user_client_mutation_unique')
      .on(table.userId, table.clientMutationId)
      .where(sql`${table.clientMutationId} is not null`),
    index('diary_logs_dashboard_idx').on(
      table.userId,
      table.diaryDate,
      table.mealSlot,
      table.deletedAt
    ),
    index('diary_logs_recency_idx').on(
      table.userId,
      table.foodId,
      table.deletedAt,
      table.loggedAt
    ),
    index('diary_logs_shortcut_undo_idx').on(
      table.userId,
      table.shortcutBatchId,
      table.deletedAt
    ),
    check(
      'diary_logs_diary_date_check',
      sql`length(${table.diaryDate}) = 10 and ${table.diaryDate} glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`
    ),
    check('diary_logs_meal_slot_check', sql`${table.mealSlot} in (${sqlStringList(mealSlots)})`),
    check('diary_logs_amount_unit_check', sql`${table.amountUnit} in (${sqlStringList(amountUnits)})`),
    check('diary_logs_portion_kind_check', sql`${table.portionKind} in (${sqlStringList(portionKinds)})`),
    check(
      'diary_logs_amounts_positive_check',
      sql`${table.basisAmount} > 0 and ${table.portionAmount} > 0 and ${table.portionCountMilli} > 0 and ${table.resolvedAmount} > 0`
    ),
    check(
      'diary_logs_basis_nutrition_non_negative_check',
      sql`${table.energyMkcalPerBasis} >= 0 and ${table.proteinMgPerBasis} >= 0 and ${table.carbsMgPerBasis} >= 0 and ${table.fatMgPerBasis} >= 0`
    ),
    check(
      'diary_logs_total_nutrition_non_negative_check',
      sql`${table.energyMkcal} >= 0 and ${table.proteinMg} >= 0 and ${table.carbsMg} >= 0 and ${table.fatMg} >= 0`
    )
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type NutritionGoal = typeof nutritionGoals.$inferSelect;
export type NewNutritionGoal = typeof nutritionGoals.$inferInsert;
export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type DiaryLog = typeof diaryLogs.$inferSelect;
export type NewDiaryLog = typeof diaryLogs.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
