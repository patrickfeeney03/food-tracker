import type {
  OfflineBootstrap,
  OfflineLogExistingFoodMutation,
  OfflineMutation,
  OfflineMutationFailure
} from './types';
import type { LogFoodInput } from '$lib/nutrition/portion-input';

const DATABASE_NAME = 'calorie-tracker-offline';
const DATABASE_VERSION = 2;

const USERS_STORE = 'users';
const DIARY_DAYS_STORE = 'diary-days';
const METADATA_STORE = 'metadata';
const OUTBOX_STORE = 'outbox';
const OUTBOX_USER_CREATED_AT_INDEX = 'user-created-at';
const ACTIVE_USER_KEY = 'active-user-id';

interface CachedUserRecord {
  userId: string;
  schemaVersion: OfflineBootstrap['schemaVersion'];
  user: OfflineBootstrap['user'];
  savedAt: number;
  snapshotPriority?: number;
  foods: OfflineBootstrap['foods'];
}

interface CachedDiaryDayRecord {
  userId: string;
  date: string;
  savedAt: number;
  snapshotPriority?: number;
  diary: OfflineBootstrap['diary'];
}

interface MetadataRecord {
  key: string;
  value: string;
}

export interface CachedOfflineData {
  schemaVersion: OfflineBootstrap['schemaVersion'];
  user: OfflineBootstrap['user'];
  savedAt: number;
  diaryDays: Record<string, OfflineBootstrap['diary']>;
  foods: OfflineBootstrap['foods'];
}

export class OfflineStorageUnsupportedError extends Error {
  constructor() {
    super('Offline storage is not supported by this browser.');
    this.name = 'OfflineStorageUnsupportedError';
  }
}

export class OfflineStorageError extends Error {
  readonly operation: string;

  constructor(operation: string, cause?: unknown) {
    super(`Offline storage failed while trying to ${operation}.`, { cause });
    this.name = 'OfflineStorageError';
    this.operation = operation;
  }
}

export class OfflineMutationConflictError extends Error {
  constructor() {
    super('This offline mutation ID is already queued with different data.');
    this.name = 'OfflineMutationConflictError';
  }
}

function offlineStorage(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new OfflineStorageUnsupportedError();
  }

  return indexedDB;
}

function storageError(
  operation: string,
  cause: unknown
): OfflineStorageError | OfflineStorageUnsupportedError {
  return cause instanceof OfflineStorageError ||
    cause instanceof OfflineStorageUnsupportedError
    ? cause
    : new OfflineStorageError(operation, cause);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  const request = offlineStorage().open(DATABASE_NAME, DATABASE_VERSION);

  return new Promise((resolve, reject) => {
    let settled = false;

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(USERS_STORE)) {
        const users = database.createObjectStore(USERS_STORE, {
          keyPath: 'userId'
        });
        users.createIndex('savedAt', 'savedAt');
      }

      if (!database.objectStoreNames.contains(DIARY_DAYS_STORE)) {
        const diaryDays = database.createObjectStore(DIARY_DAYS_STORE, {
          keyPath: ['userId', 'date']
        });
        diaryDays.createIndex('userId', 'userId');
      }

      if (!database.objectStoreNames.contains(METADATA_STORE)) {
        database.createObjectStore(METADATA_STORE, {
          keyPath: 'key'
        });
      }

      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = database.createObjectStore(OUTBOX_STORE, {
          keyPath: ['userId', 'clientMutationId']
        });
        outbox.createIndex(
          OUTBOX_USER_CREATED_AT_INDEX,
          ['userId', 'createdAt']
        );
      }
    };

    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }

      settled = true;
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };

    request.onerror = () => {
      settled = true;
      reject(request.error);
    };

    request.onblocked = () => {
      settled = true;
      reject(new Error('Another page is blocking the offline storage upgrade.'));
    };
  });
}

function sameLogMutation(
  left: OfflineLogExistingFoodMutation,
  right: OfflineLogExistingFoodMutation
): boolean {
  return left.userId === right.userId &&
    left.clientMutationId === right.clientMutationId &&
    left.kind === right.kind &&
    left.foodId === right.foodId &&
    left.input.clientMutationId === right.input.clientMutationId &&
    left.input.portionKind === right.input.portionKind &&
    left.input.portionCount === right.input.portionCount &&
    left.input.diaryDate === right.input.diaryDate &&
    left.input.mealSlot === right.input.mealSlot;
}

function shouldReplaceSnapshot(
  existing: { savedAt: number; snapshotPriority?: number } | undefined,
  savedAt: number,
  snapshotPriority: number
): boolean {
  return existing === undefined ||
    savedAt > existing.savedAt ||
    (
      savedAt === existing.savedAt &&
      snapshotPriority >= (existing.snapshotPriority ?? 0)
    );
}

function cloneForStorage<T>(value: T): T {
  if (typeof structuredClone !== 'function') {
    return value;
  }

  try {
    return structuredClone(value);
  } catch (cause) {
    throw new OfflineStorageError('prepare data for saving', cause);
  }
}

export async function saveOfflineBootstrap(bootstrap: OfflineBootstrap): Promise<void> {
  const safeBootstrap = cloneForStorage(bootstrap);
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(
      [USERS_STORE, DIARY_DAYS_STORE, METADATA_STORE],
      'readwrite'
    );
    const completion = transactionComplete(transaction);
    const users = transaction.objectStore(USERS_STORE);
    const diaryDays = transaction.objectStore(DIARY_DAYS_STORE);
    const metadata = transaction.objectStore(METADATA_STORE);

    const existingUser = await requestResult<CachedUserRecord | undefined>(
      users.get(safeBootstrap.user.id)
    );
    const diaryKey = [safeBootstrap.user.id, safeBootstrap.diary.date];
    const existingDiary = await requestResult<CachedDiaryDayRecord | undefined>(
      diaryDays.get(diaryKey)
    );

    if (shouldReplaceSnapshot(existingUser, safeBootstrap.savedAt, 0)) {
      users.put({
        userId: safeBootstrap.user.id,
        schemaVersion: safeBootstrap.schemaVersion,
        user: safeBootstrap.user,
        savedAt: safeBootstrap.savedAt,
        snapshotPriority: 0,
        foods: safeBootstrap.foods
      } satisfies CachedUserRecord);
    }

    if (shouldReplaceSnapshot(existingDiary, safeBootstrap.savedAt, 0)) {
      diaryDays.put({
        userId: safeBootstrap.user.id,
        date: safeBootstrap.diary.date,
        savedAt: safeBootstrap.savedAt,
        snapshotPriority: 0,
        diary: safeBootstrap.diary
      } satisfies CachedDiaryDayRecord);
    }

    metadata.put({
      key: ACTIVE_USER_KEY,
      value: safeBootstrap.user.id
    } satisfies MetadataRecord);

    await completion;
  } catch (cause) {
    throw storageError('save offline data', cause);
  } finally {
    database?.close();
  }
}

export async function readActiveUserId(): Promise<string | null> {
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(METADATA_STORE, 'readonly');
    const record = await requestResult<MetadataRecord | undefined>(
      transaction.objectStore(METADATA_STORE).get(ACTIVE_USER_KEY)
    );

    return record?.value ?? null;
  } catch (cause) {
    throw storageError('read the active offline user', cause);
  } finally {
    database?.close();
  }
}

export async function readOfflineData(userId: string): Promise<CachedOfflineData | null> {
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(
      [USERS_STORE, DIARY_DAYS_STORE],
      'readonly'
    );
    const user = await requestResult<CachedUserRecord | undefined>(
      transaction.objectStore(USERS_STORE).get(userId)
    );

    if (user === undefined) {
      return null;
    }

    const diaryRecords = await requestResult<CachedDiaryDayRecord[]>(
      transaction.objectStore(DIARY_DAYS_STORE).index('userId').getAll(userId)
    );
    const diaryDays = Object.fromEntries(
      diaryRecords
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((record) => [record.date, record.diary])
    );

    return {
      schemaVersion: user.schemaVersion,
      user: user.user,
      savedAt: user.savedAt,
      diaryDays,
      foods: user.foods
    };
  } catch (cause) {
    throw storageError('read offline data', cause);
  } finally {
    database?.close();
  }
}

export async function readActiveOfflineData(): Promise<CachedOfflineData | null> {
  const userId = await readActiveUserId();

  return userId === null
    ? null
    : readOfflineData(userId);
}

export async function enqueueOfflineMutation(
  mutation: OfflineLogExistingFoodMutation
): Promise<void> {
  const safeMutation = cloneForStorage(mutation);
  let database: IDBDatabase | undefined;

  if (safeMutation.clientMutationId !== safeMutation.input.clientMutationId) {
    throw new OfflineMutationConflictError();
  }

  try {
    database = await openDatabase();
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    const completion = transactionComplete(transaction);
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const existing = await requestResult<OfflineMutation | undefined>(
      outbox.get([safeMutation.userId, safeMutation.clientMutationId])
    );

    if (existing === undefined) {
      outbox.add(safeMutation);
    } else if (!sameLogMutation(existing, safeMutation)) {
      throw new OfflineMutationConflictError();
    }

    await completion;
  } catch (cause) {
    if (cause instanceof OfflineMutationConflictError) {
      throw cause;
    }

    throw storageError('queue an offline change', cause);
  } finally {
    database?.close();
  }
}

export function enqueueOfflineDiaryLog(
  userId: string,
  foodId: string,
  input: LogFoodInput,
  createdAt = Date.now()
): Promise<void> {
  return enqueueOfflineMutation({
    userId,
    clientMutationId: input.clientMutationId,
    kind: 'log-existing-food',
    foodId,
    input,
    createdAt,
    state: 'pending'
  });
}

export async function listOfflineMutations(
  userId: string
): Promise<OfflineMutation[]> {
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(OUTBOX_STORE, 'readonly');
    const records = await requestResult<OfflineMutation[]>(
      transaction.objectStore(OUTBOX_STORE).getAll()
    );

    return records
      .filter((record) => record.userId === userId)
      .sort((left, right) =>
        left.createdAt - right.createdAt ||
        left.clientMutationId.localeCompare(right.clientMutationId)
      );
  } catch (cause) {
    throw storageError('read queued offline changes', cause);
  } finally {
    database?.close();
  }
}

export async function hasActiveOfflineMutations(): Promise<boolean> {
  const userId = await readActiveUserId();

  if (userId === null) {
    return false;
  }

  return (await listOfflineMutations(userId)).length > 0;
}

export async function listOfflineDiaryLogMutations(
  userId: string
): Promise<OfflineLogExistingFoodMutation[]> {
  const mutations = await listOfflineMutations(userId);

  return mutations.filter(
    (mutation): mutation is OfflineLogExistingFoodMutation =>
      mutation.kind === 'log-existing-food'
  );
}

export async function markOfflineMutationFailed(
  userId: string,
  clientMutationId: string,
  failure: OfflineMutationFailure
): Promise<void> {
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    const completion = transactionComplete(transaction);
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const key = [userId, clientMutationId];
    const existing = await requestResult<OfflineMutation | undefined>(
      outbox.get(key)
    );

    if (existing !== undefined) {
      outbox.put({
        ...existing,
        state: 'failed',
        failure: cloneForStorage(failure)
      } satisfies OfflineMutation);
    }

    await completion;
  } catch (cause) {
    throw storageError('mark an offline change as failed', cause);
  } finally {
    database?.close();
  }
}

export function markOfflineDiaryLogFailed(
  userId: string,
  clientMutationId: string,
  failure: OfflineMutationFailure
): Promise<void> {
  return markOfflineMutationFailed(userId, clientMutationId, failure);
}

export async function markOfflineMutationPending(
  userId: string,
  clientMutationId: string
): Promise<void> {
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    const completion = transactionComplete(transaction);
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const existing = await requestResult<OfflineMutation | undefined>(
      outbox.get([userId, clientMutationId])
    );

    if (existing !== undefined) {
      const pending: OfflineMutation = {
        ...existing,
        state: 'pending'
      };
      delete pending.failure;
      outbox.put(pending);
    }

    await completion;
  } catch (cause) {
    throw storageError('retry an offline change', cause);
  } finally {
    database?.close();
  }
}

export function retryOfflineDiaryLog(
  userId: string,
  clientMutationId: string
): Promise<void> {
  return markOfflineMutationPending(userId, clientMutationId);
}

export async function discardOfflineMutation(
  userId: string,
  clientMutationId: string
): Promise<void> {
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(OUTBOX_STORE, 'readwrite');
    const completion = transactionComplete(transaction);
    transaction.objectStore(OUTBOX_STORE).delete([userId, clientMutationId]);
    await completion;
  } catch (cause) {
    throw storageError('discard an offline change', cause);
  } finally {
    database?.close();
  }
}

export function discardOfflineDiaryLog(
  userId: string,
  clientMutationId: string
): Promise<void> {
  return discardOfflineMutation(userId, clientMutationId);
}

export async function acknowledgeOfflineMutation(
  userId: string,
  clientMutationId: string,
  bootstrap: OfflineBootstrap
): Promise<void> {
  if (bootstrap.user.id !== userId) {
    throw new OfflineMutationConflictError();
  }

  const safeBootstrap = cloneForStorage(bootstrap);
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(
      [USERS_STORE, DIARY_DAYS_STORE, METADATA_STORE, OUTBOX_STORE],
      'readwrite'
    );
    const completion = transactionComplete(transaction);
    const users = transaction.objectStore(USERS_STORE);
    const diaryDays = transaction.objectStore(DIARY_DAYS_STORE);
    const metadata = transaction.objectStore(METADATA_STORE);
    const outbox = transaction.objectStore(OUTBOX_STORE);
    const existingUser = await requestResult<CachedUserRecord | undefined>(
      users.get(userId)
    );
    const diaryKey = [userId, safeBootstrap.diary.date];
    const existingDiary = await requestResult<CachedDiaryDayRecord | undefined>(
      diaryDays.get(diaryKey)
    );

    if (shouldReplaceSnapshot(existingUser, safeBootstrap.savedAt, 1)) {
      users.put({
        userId,
        schemaVersion: safeBootstrap.schemaVersion,
        user: safeBootstrap.user,
        savedAt: safeBootstrap.savedAt,
        snapshotPriority: 1,
        foods: safeBootstrap.foods
      } satisfies CachedUserRecord);
    }

    if (shouldReplaceSnapshot(existingDiary, safeBootstrap.savedAt, 1)) {
      diaryDays.put({
        userId,
        date: safeBootstrap.diary.date,
        savedAt: safeBootstrap.savedAt,
        snapshotPriority: 1,
        diary: safeBootstrap.diary
      } satisfies CachedDiaryDayRecord);
    }

    metadata.put({
      key: ACTIVE_USER_KEY,
      value: userId
    } satisfies MetadataRecord);
    outbox.delete([userId, clientMutationId]);

    await completion;
  } catch (cause) {
    throw storageError('acknowledge an offline change', cause);
  } finally {
    database?.close();
  }
}

export function acknowledgeOfflineDiaryLog(
  bootstrap: OfflineBootstrap,
  clientMutationId: string
): Promise<void> {
  return acknowledgeOfflineMutation(
    bootstrap.user.id,
    clientMutationId,
    bootstrap
  );
}

export async function clearOfflineUser(userId: string): Promise<void> {
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(
      [USERS_STORE, DIARY_DAYS_STORE, METADATA_STORE, OUTBOX_STORE],
      'readwrite'
    );
    const completion = transactionComplete(transaction);
    const diaryDays = transaction.objectStore(DIARY_DAYS_STORE);
    const metadata = transaction.objectStore(METADATA_STORE);

    transaction.objectStore(USERS_STORE).delete(userId);

    const diaryKeys = await requestResult<IDBValidKey[]>(
      diaryDays.index('userId').getAllKeys(userId)
    );
    for (const key of diaryKeys) {
      diaryDays.delete(key);
    }

    const activeUser = await requestResult<MetadataRecord | undefined>(
      metadata.get(ACTIVE_USER_KEY)
    );
    if (activeUser?.value === userId) {
      metadata.delete(ACTIVE_USER_KEY);
    }

    const queuedMutations = await requestResult<OfflineMutation[]>(
      transaction.objectStore(OUTBOX_STORE).getAll()
    );
    for (const mutation of queuedMutations) {
      if (mutation.userId === userId) {
        transaction.objectStore(OUTBOX_STORE).delete([
          mutation.userId,
          mutation.clientMutationId
        ]);
      }
    }

    await completion;
  } catch (cause) {
    throw storageError('clear offline data for this user', cause);
  } finally {
    database?.close();
  }
}

export async function clearAllOfflineData(): Promise<void> {
  let database: IDBDatabase | undefined;

  try {
    database = await openDatabase();
    const transaction = database.transaction(
      [USERS_STORE, DIARY_DAYS_STORE, METADATA_STORE, OUTBOX_STORE],
      'readwrite'
    );
    const completion = transactionComplete(transaction);

    transaction.objectStore(USERS_STORE).clear();
    transaction.objectStore(DIARY_DAYS_STORE).clear();
    transaction.objectStore(METADATA_STORE).clear();
    transaction.objectStore(OUTBOX_STORE).clear();

    await completion;
  } catch (cause) {
    throw storageError('clear all offline data', cause);
  } finally {
    database?.close();
  }
}
