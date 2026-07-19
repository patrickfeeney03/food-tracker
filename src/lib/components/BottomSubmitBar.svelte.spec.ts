import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import BottomSubmitBar from './BottomSubmitBar.svelte';

describe('BottomSubmitBar', () => {
  it('renders a form submit action', async () => {
    render(BottomSubmitBar, { label: 'Save changes' });

    const button = page.getByRole('button', { name: 'Save changes' });
    await expect.element(button).toHaveAttribute('type', 'submit');
    await expect.element(button).toBeEnabled();
  });

  it('exposes its disabled state', async () => {
    render(BottomSubmitBar, { label: 'Add to diary', disabled: true });

    await expect.element(page.getByRole('button', { name: 'Add to diary' })).toBeDisabled();
  });

  it('exposes its busy state and prevents submission', async () => {
    render(BottomSubmitBar, { label: 'Adding…', busy: true });

    const button = page.getByRole('button', { name: 'Adding…' });
    await expect.element(button).toBeDisabled();
    await expect.element(button).toHaveAttribute('aria-busy', 'true');
  });
});
