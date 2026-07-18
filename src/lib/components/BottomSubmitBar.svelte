<script lang="ts">
  let {
    label,
    disabled = false,
    layout = "contained",
  }: {
    label: string;
    disabled?: boolean;
    layout?: "contained" | "floating";
  } = $props();
</script>

<div
  class={layout === "floating"
    ? "fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full bg-[var(--app-surface)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:bottom-6 sm:max-w-3xl sm:justify-center sm:rounded-b-[26px] sm:px-8 sm:pb-4 sm:pt-4 lg:max-w-5xl"
    : "fixed inset-x-0 bottom-0 z-10 bg-[var(--app-surface)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:absolute sm:px-8 sm:py-4"}
>
  <button
    type="submit"
    {disabled}
    class={layout === "floating"
      ? "flex min-h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--app-accent)] px-4 text-[14px] font-bold text-white shadow-sm transition hover:bg-[var(--app-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)] active:translate-y-px sm:w-56"
      : "mx-auto block min-h-14 w-full max-w-xl cursor-pointer rounded-[13px] border-0 bg-[var(--app-accent)] px-5 text-[14px] font-bold text-white shadow-[0_3px_8px_rgba(40,101,232,0.22)] transition hover:bg-[var(--app-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]/35"}
  >{label}</button>
</div>
