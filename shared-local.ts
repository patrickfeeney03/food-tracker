import { resolve } from "node:path";

export const SHARED_LOCAL_DIR = process.env.CALORIES_SHARED_DIR ?? '/home/patrick/code/food-tracker';
export const SHARED_ENV_FILE = resolve(SHARED_LOCAL_DIR, '.env');
