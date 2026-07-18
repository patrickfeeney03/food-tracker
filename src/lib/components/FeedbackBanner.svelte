<script lang="ts">
  let {
    message,
    tone = "success",
    class: className = "",
  }: {
    message: string;
    tone?: "success" | "danger";
    class?: string;
  } = $props();

  let role = $derived(tone === "danger" ? "alert" : "status");
  let toneClass = $derived(
    tone === "danger"
      ? `border-[var(--app-danger-border)] bg-[var(--app-danger-bg)]
        text-[var(--app-danger-text)]`
      : `border-[var(--app-success-border)] bg-[var(--app-success-bg)]
        text-[var(--app-success-text)]`,
  );
</script>

<div
  {role}
  class={[
    "rounded-xl border px-3 py-2.5 text-sm font-medium",
    toneClass,
    className,
  ]}
>
  {message}
</div>
