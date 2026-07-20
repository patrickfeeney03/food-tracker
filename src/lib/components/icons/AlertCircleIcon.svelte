<script lang="ts">
  let { class: className = '' }: { class?: string } = $props();
</script>

<svg class={className} viewBox="0 0 20 20" aria-hidden="true">
  <path
    d="M10 6.5v4M10 14h.01M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
  />
</svg>
