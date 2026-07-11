import { env } from '$env/dynamic/private';
import { createDatabase } from './connection';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const connection = createDatabase(env.DATABASE_URL);

export const db = connection.db;
export const sqlite = connection.client;
