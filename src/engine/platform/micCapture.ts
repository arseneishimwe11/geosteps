/**
 * Ambient-audio capture for acoustic fingerprinting (browser-only glue).
 *
 * Used in two places:
 *  - admin calibration: record ~8 s of a zone's ambience once, encode with
 *    computeFingerprint(), store in the blueprint.
 *  - tourist runtime: periodically grab ~2 s, fingerprint it, and hand it to
 *    PositionEngine.handleAcousticSample().
 *
 * Echo cancellation / noise suppression / auto gain are explicitly disabled:
 * those DSP stages are built to REMOVE exactly the steady room tone the
 * fingerprint depends on.
 *
 * Note: this keeps a getUserMedia stream open only for the capture window and
 * stops all tracks afterwards, so the OS mic indicator is honest about when
 * the app listens. Like every sensor here, capture only works while the tab
 * is visible and the screen is on.
 */
export interface MicCaptureResult {
  pcm: Float32Array;
  sampleRateHz: number;
}

interface MicEnv {
  navigator: { mediaDevices: { getUserMedia(c: MediaStreamConstraints): Promise<MediaStream> } };
  AudioContext: typeof AudioContext;
}

export async function captureAmbientClip(seconds: number, env?: MicEnv): Promise<MicCaptureResult> {
  const e: MicEnv = env ?? {
    navigator: navigator as MicEnv['navigator'],
    AudioContext: (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext,
  };

  const stream = await e.navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });

  const ctx = new e.AudioContext();
  try {
    const source = ctx.createMediaStreamSource(stream);
    // ScriptProcessorNode is deprecated but universally shipped; an
    // AudioWorklet variant is a drop-in upgrade later (needs a module file).
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const wanted = Math.ceil(seconds * ctx.sampleRate);
    const chunks: Float32Array[] = [];
    let collected = 0;

    const done = new Promise<void>((resolve) => {
      proc.onaudioprocess = (ev) => {
        const data = ev.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(data));
        collected += data.length;
        if (collected >= wanted) resolve();
      };
    });

    source.connect(proc);
    proc.connect(ctx.destination); // required by some browsers for the node to run
    await done;
    proc.disconnect();
    source.disconnect();

    const pcm = new Float32Array(Math.min(collected, wanted));
    let offset = 0;
    for (const c of chunks) {
      if (offset >= pcm.length) break;
      pcm.set(c.subarray(0, Math.min(c.length, pcm.length - offset)), offset);
      offset += c.length;
    }
    return { pcm, sampleRateHz: ctx.sampleRate };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    await ctx.close().catch(() => undefined);
  }
}
