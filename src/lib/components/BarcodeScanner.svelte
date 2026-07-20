<script lang="ts">
  import CameraOffIcon from "./icons/CameraOffIcon.svelte";
  import CloseIcon from "./icons/CloseIcon.svelte";
  import FlashIcon from "./icons/FlashIcon.svelte";
  import { inputLimits } from "$lib/nutrition/input-limits";
  import { onMount, tick } from "svelte";
  import type { IScannerControls } from "@zxing/browser";

  type Props = {
    onscan: (barcode: string) => void;
    onclose: () => void;
  };

  let { onscan, onclose }: Props = $props();

  let videoElement = $state<HTMLVideoElement>();
  let manualInput = $state<HTMLInputElement>();
  let controls: IScannerControls | undefined;
  let status = $state<"starting" | "scanning" | "error">("starting");
  let errorMessage = $state("");
  let torchAvailable = $state(false);
  let torchOn = $state(false);
  let manualMode = $state(false);
  let manualBarcode = $state("");
  let manualError = $state("");
  let disposed = false;
  let hasResult = false;
  let scanAttempt = 0;

  function stopScanner() {
    const currentControls = controls;
    controls = undefined;
    torchAvailable = false;
    torchOn = false;

    if (currentControls) {
      Promise.resolve(currentControls.stop()).catch(() => {});
    }
  }

  function cameraErrorMessage(error: unknown): string {
    if (!(error instanceof DOMException)) {
      return "The camera could not be started. You can retry or enter the code manually.";
    }

    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Camera access was blocked. Allow camera access in your browser settings, then retry.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "No usable rear camera was found on this device.";
      case "NotReadableError":
      case "AbortError":
        return "The camera is busy in another app or browser tab. Close it there, then retry.";
      default:
        return "The camera could not be started. You can retry or enter the code manually.";
    }
  }

  async function startScanner() {
    const attempt = ++scanAttempt;
    stopScanner();
    status = "starting";
    errorMessage = "";
    hasResult = false;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      status = "error";
      errorMessage =
        "Camera access requires HTTPS, except on localhost. Open this app on localhost or use a secure development URL.";
      return;
    }

    try {
      const { BrowserMultiFormatOneDReader } = await import("@zxing/browser");

      if (disposed || manualMode || attempt !== scanAttempt) return;

      const reader = new BrowserMultiFormatOneDReader(undefined, {
        delayBetweenScanAttempts: 120,
        delayBetweenScanSuccess: 500,
      });

      const nextControls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 960 },
            height: { ideal: 540 },
          },
        },
        videoElement,
        (result) => {
          if (!result || hasResult) return;

          const barcode = result.getText().trim();
          if (barcode === "") return;

          hasResult = true;
          navigator.vibrate?.(80);
          stopScanner();
          onscan(barcode);
        },
      );

      if (disposed || manualMode || attempt !== scanAttempt) {
        nextControls.stop();
        return;
      }

      controls = nextControls;
      torchAvailable = Boolean(nextControls.switchTorch);
      status = "scanning";
    } catch (error) {
      if (disposed || manualMode || attempt !== scanAttempt) return;
      stopScanner();
      status = "error";
      errorMessage = cameraErrorMessage(error);
    }
  }

  async function toggleTorch() {
    if (!controls?.switchTorch) return;

    try {
      const nextValue = !torchOn;
      await controls.switchTorch(nextValue);
      torchOn = nextValue;
    } catch {
      torchAvailable = false;
      torchOn = false;
    }
  }

  async function showManualEntry() {
    scanAttempt += 1;
    stopScanner();
    manualMode = true;
    manualError = "";
    await tick();
    manualInput?.focus();
  }

  async function showCamera() {
    manualMode = false;
    manualError = "";
    await tick();
    void startScanner();
  }

  function submitManualBarcode(event: SubmitEvent) {
    event.preventDefault();
    const barcode = manualBarcode.trim();

    if (barcode === "") {
      manualError = "Enter the numbers printed below the barcode.";
      return;
    }

    if (barcode.length > 200) {
      manualError = "Barcode must have at most 200 characters.";
      return;
    }

    onscan(barcode);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") onclose();
  }

  onMount(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void startScanner();

    return () => {
      disposed = true;
      scanAttempt += 1;
      stopScanner();
      document.body.style.overflow = previousOverflow;
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex min-h-dvh items-end justify-center bg-black/75 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
  role="presentation"
>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="scanner-title"
    aria-describedby="scanner-help"
    class="flex max-h-dvh min-h-[78dvh] w-full max-w-lg flex-col overflow-hidden
      rounded-t-[26px] bg-[var(--app-surface)] text-[var(--app-text)] shadow-2xl
      sm:min-h-0 sm:rounded-[26px]"
  >
    <header class="grid grid-cols-[44px_1fr_44px] items-center px-3 pt-3 sm:px-5 sm:pt-5">
      <button
        type="button"
        onclick={onclose}
        aria-label="Close barcode scanner"
        class="inline-flex size-11 items-center justify-center rounded-xl text-[var(--app-text)]
          transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-2
          focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
      >
        <CloseIcon class="size-5" />
      </button>

      <h2 id="scanner-title" class="text-center text-[18px] font-bold tracking-[-0.02em]">
        {manualMode ? "Enter barcode" : "Scan barcode"}
      </h2>

      {#if !manualMode && torchAvailable}
        <button
          type="button"
          onclick={toggleTorch}
          aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
          aria-pressed={torchOn}
          class="inline-flex size-11 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
          class:bg-[var(--app-action)]={torchOn}
          class:text-white={torchOn}
          class:text-[var(--app-text)]={!torchOn}
        >
          <FlashIcon class="size-5" />
        </button>
      {:else}
        <span aria-hidden="true" class="size-11"></span>
      {/if}
    </header>

    {#if manualMode}
      <form onsubmit={submitManualBarcode} class="flex flex-1 flex-col px-5 pb-5 pt-10 sm:px-7 sm:pb-7">
        <div>
          <label for="manual-barcode" class="!text-[11px] !font-bold !uppercase !tracking-[0.04em] !text-[var(--app-muted)]">
            Barcode number
          </label>
          <input
            bind:this={manualInput}
            id="manual-barcode"
            name="barcode"
            bind:value={manualBarcode}
            maxlength={inputLimits.food.barcode.maxLength}
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            inputmode="numeric"
            aria-invalid={manualError ? "true" : undefined}
            placeholder="e.g. 0012345678905"
            class="mt-2 !min-h-14 !rounded-xl !border-[var(--app-border)]
              !bg-[var(--app-panel)] !px-4 !text-base !font-semibold !text-[var(--app-text)]
              !shadow-none focus:!border-[var(--app-accent)] focus:!ring-[var(--app-accent)]/15"
          />
          {#if manualError}
            <p role="alert" class="mt-2 !text-sm !font-medium !text-[var(--app-danger-text)]">{manualError}</p>
          {/if}
          <p id="scanner-help" class="mt-3 text-sm leading-5 text-[var(--app-muted)]">
            Enter the full code exactly as printed, including any leading zeroes.
          </p>
        </div>

        <div class="mt-auto grid gap-3 pt-8">
          <button type="submit" class="min-h-12 rounded-xl bg-[var(--app-accent)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--app-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-text)]">
            Use code
          </button>
          <button type="button" onclick={showCamera} class="min-h-12 rounded-xl bg-[var(--app-panel)] px-5 text-sm font-bold text-[var(--app-text)] shadow-sm ring-1 ring-[var(--app-border)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]">
            Back to camera
          </button>
        </div>
      </form>
    {:else}
      <div class="flex flex-1 flex-col px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div class="relative min-h-[330px] flex-1 overflow-hidden rounded-[20px] bg-[#111827] sm:aspect-[4/3] sm:min-h-0">
          <video
            bind:this={videoElement}
            autoplay
            muted
            playsinline
            aria-label="Live camera preview"
            class="absolute inset-0 size-full object-cover"
          ></video>

          <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,10,20,.34),transparent_23%,transparent_77%,rgba(5,10,20,.34))]"></div>
          <div class="pointer-events-none absolute left-1/2 top-1/2 h-36 w-[84%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(5,10,20,0.28)]">
            <span class="absolute left-4 right-4 top-1/2 h-px -translate-y-1/2 bg-[#ff5b5b] shadow-[0_0_8px_rgba(255,91,91,.8)]"></span>
          </div>

          {#if status === "starting"}
            <div class="absolute inset-0 flex items-center justify-center bg-[#111827]/70 text-white">
              <div class="text-center">
                <span class="mx-auto block size-7 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                <p class="mt-3 text-sm font-semibold">Starting camera…</p>
              </div>
            </div>
          {:else if status === "error"}
            <div class="absolute inset-0 flex items-center justify-center bg-[#111827] px-7 text-center text-white">
              <div>
                <div class="mx-auto flex size-11 items-center justify-center rounded-full bg-white/10">
                  <CameraOffIcon class="size-5" />
                </div>
                <p class="mt-4 text-sm leading-5 font-semibold">{errorMessage}</p>
                <button type="button" onclick={startScanner} class="mt-5 min-h-11 rounded-xl bg-white px-5 text-sm font-bold text-[#172033] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  Retry camera
                </button>
              </div>
            </div>
          {/if}
        </div>

        <p id="scanner-help" class="mt-4 text-center text-sm leading-5 font-medium text-[var(--app-muted)]">
          Place the retail barcode inside the frame.
        </p>
        <p class="sr-only" aria-live="polite">
          {status === "scanning" ? "Camera ready. Looking for a barcode." : errorMessage}
        </p>

        <button type="button" onclick={showManualEntry} class="mt-4 min-h-12 rounded-xl bg-[var(--app-panel)] px-5 text-sm font-bold text-[var(--app-text)] shadow-sm ring-1 ring-[var(--app-border)] transition hover:bg-[var(--app-panel-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]">
          Enter barcode manually
        </button>
      </div>
    {/if}
  </div>
</div>
