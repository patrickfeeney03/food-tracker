<script lang="ts">
  let { class: className = '' }: { class?: string } = $props();
</script>

<svg class={className} viewBox="0 0 48 48" role="img">
  <path
    d="M24 7.5a16.5 16.5 0 1 0 16.5 16.5"
    fill="none"
    stroke="currentColor"
    stroke-width="6"
    stroke-linecap="round"
  />
  <path
    d="M24 7.5a16.5 16.5 0 0 1 14.3 8.25"
    fill="none"
    stroke="var(--app-green)"
    stroke-width="6"
    stroke-linecap="round"
  />
  <circle cx="24" cy="24" r="3.5" fill="var(--app-text)" />
</svg>
