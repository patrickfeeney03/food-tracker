<script lang="ts">
  import { resolve } from "$app/paths";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Sign In | Calorie Tracker</title>
</svelte:head>

<main>
  <h1>Calorie Tracker</h1>
  <p>Your personal food and nutrition tracker.</p>

  {#if data.errorMessage}
    <p role="alert">{data.errorMessage}</p>
  {/if}

  <a href={resolve("/auth/google")}> Continue with Google </a>
</main>
