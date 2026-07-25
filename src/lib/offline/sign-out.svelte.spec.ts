import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasActiveOfflineMutations = vi.fn();
const clearOfflineCacheForSignOut = vi.fn();

vi.mock('./indexed-db', () => ({
  hasActiveOfflineMutations: (...args: unknown[]) =>
    hasActiveOfflineMutations(...args)
}));

vi.mock('./client', () => ({
  clearOfflineCacheForSignOut: (...args: unknown[]) =>
    clearOfflineCacheForSignOut(...args)
}));

import { handleOfflineAwareSignOut } from './sign-out';

function makeSubmitEvent(form: HTMLFormElement): SubmitEvent {
  const event = new Event('submit', {
    bubbles: true,
    cancelable: true
  }) as SubmitEvent;

  Object.defineProperty(event, 'currentTarget', {
    configurable: true,
    value: form
  });

  return event;
}

describe('handleOfflineAwareSignOut', () => {
  beforeEach(() => {
    hasActiveOfflineMutations.mockReset();
    clearOfflineCacheForSignOut.mockReset();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('warns and cancels when the user declines discarding unsynced changes', async () => {
    hasActiveOfflineMutations.mockResolvedValue(true);
    vi.stubGlobal('confirm', vi.fn(() => false));

    const form = document.createElement('form');
    const submit = vi.spyOn(form, 'submit').mockImplementation(() => {});
    const event = makeSubmitEvent(form);

    await expect(handleOfflineAwareSignOut(event)).resolves.toBe('cancelled');
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(clearOfflineCacheForSignOut).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
    expect(form.dataset.signingOut).toBeUndefined();
  });

  it('clears offline data and submits when there are no unsynced changes', async () => {
    hasActiveOfflineMutations.mockResolvedValue(false);

    const form = document.createElement('form');
    const submit = vi.spyOn(form, 'submit').mockImplementation(() => {});
    const event = makeSubmitEvent(form);

    await expect(handleOfflineAwareSignOut(event)).resolves.toBe('submitted');
    expect(window.confirm).not.toHaveBeenCalled();
    expect(clearOfflineCacheForSignOut).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });

  it('clears offline data after the user confirms discarding unsynced changes', async () => {
    hasActiveOfflineMutations.mockResolvedValue(true);

    const form = document.createElement('form');
    const submit = vi.spyOn(form, 'submit').mockImplementation(() => {});
    const event = makeSubmitEvent(form);

    await expect(handleOfflineAwareSignOut(event)).resolves.toBe('submitted');
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(clearOfflineCacheForSignOut).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
  });
});
