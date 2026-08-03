import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AppPageShell from './AppPageShell.svelte';

const children = createRawSnippet(() => ({
  render: () => '<h1>Page content</h1>'
}));

describe('AppPageShell', () => {
  it('renders compact page content inside the application surface', async () => {
    render(AppPageShell, { children, class: 'px-4' });

    await expect.element(page.getByRole('main')).toHaveClass('max-w-[430px]', 'px-4');
    await expect.element(page.getByRole('heading', { name: 'Page content' })).toBeInTheDocument();
  });

  it('supports the shared wide page frame', async () => {
    render(AppPageShell, { children, size: 'wide' });

    await expect.element(page.getByRole('main')).toHaveClass('sm:max-w-3xl', 'lg:max-w-5xl');
  });

  it('supports the diary page frame', async () => {
    render(AppPageShell, { children, variant: 'diary' });

    const main = page.getByRole('main');

    await expect.element(main).toHaveClass(
      'max-w-[430px]',
      'bg-[var(--app-diary-surface)]',
      'pt-[calc(1.125rem+env(safe-area-inset-top))]',
      'sm:min-h-[calc(100dvh-40px)]',
      'lg:max-w-[1180px]',
      'xl:max-w-[1260px]'
    );
    expect(main.element().parentElement).toHaveClass(
      'bg-[var(--app-canvas)]',
      'text-[var(--app-text)]',
      'sm:py-5',
      'lg:p-7'
    );
  });
});
