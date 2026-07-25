<script lang="ts">
  import TrackerShell from "$lib/components/tracker/TrackerShell.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<TrackerShell initialData={data} />
