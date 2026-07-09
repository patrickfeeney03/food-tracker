import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export interface UserSettings {
  targetCalories: number; // kcal
  targetProteinMg: number;
  targetCarbsMg: number;
  targetFatMg: number;
  darkMode?: boolean;
}

export interface AdditionalNutrition {
  fiberMg?: number;
  sugarMg?: number;
  saturatedFatMg?: number;
  sodiumMg?: number;
  potassiumMg?: number;
}

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  settings: text('settings', { mode: 'json' }).$type<UserSettings>().notNull().default({
    targetCalories: 2900,
    targetProteinMg: 200_000,
    targetCarbsMg: 300_000,
    targetFatMg: 90_000,
    darkMode: false
  }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

export const foods = sqliteTable('foods', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  brand: text('brand'),
  barcode: text('barcode'),

  caloriesPer100g: integer('calories_per_100g').notNull(), // kcal
  proteinMgPer100g: integer('protein_mg_per_100g').notNull(), // in mg
  carbsMgPer100g: integer('carbs_mg_per_100g').notNull(), //  in mg
  fatMgPer100g: integer('fat_mg_per_100g').notNull(),

  // this is json to expand it easily
  additionalNutrition: text('additional_nutrition', { mode: 'json' }).$type<AdditionalNutrition>(),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' })

}, (table) => [
  index('barcode_idx').on(table.barcode),
  index('deleted_at_idx').on(table.deletedAt)
]);

export const diaryLogs = sqliteTable('diary_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  foodId: text('food_id').references(() => foods.id, { onDelete: 'set null' }),
  foodName: text('food_name').notNull(),
  weightMg: integer('weight_mg').notNull(),
  calories: integer('calories').notNull(),
  proteinMg: integer('protein_mg').notNull(),
  carbsMg: integer('carbs_mg').notNull(),
  fatMg: integer('fat_mg').notNull(),
  additionalNutrition: text('additional_nutrition', { mode: 'json' }).$type<AdditionalNutrition>(),
  loggedAt: integer('logged_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}, (table) => [
  index('diary_user_id_idx').on(table.userId),
  index('diary_logged_at_idx').on(table.loggedAt)
]);

export const meals = sqliteTable('meals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' })
}, (table) => [
  index('meals_user_id_idx').on(table.userId)
]);

export const mealIngredients = sqliteTable('meal_ingredients', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  mealId: text('meal_id').notNull().references(() => meals.id, { onDelete: 'cascade' }),
  foodId: text('food_id').notNull().references(() => foods.id, { onDelete: 'cascade' }),
  weightMg: integer('weight_mg').notNull()
}, (table) => [
  index('meal_ingredients_meal_id_idx').on(table.mealId)
]);
