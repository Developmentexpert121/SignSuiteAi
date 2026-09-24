import * as faceapi from "@vladmandic/face-api";

export const FACE_MODEL_URL =
  (typeof window !== "undefined" ? window.location.origin : "") +
  `${import.meta.env.BASE_URL}models/`;

let loadPromise: Promise<void> | null = null;
let loaded = false;

export function areFaceModelsLoaded(): boolean {
  return loaded;
}

export function loadFaceModels(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const tf = (faceapi as unknown as { tf: {
      setBackend: (b: string) => Promise<boolean>;
      ready: () => Promise<void>;
    } }).tf;

    try {
      await tf.setBackend("webgl");
    } catch {
      try {
        await tf.setBackend("cpu");
      } catch {
        /* leave whatever default backend */
      }
    }
    await tf.ready();

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
    ]);

    loaded = true;
  })().catch(err => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

export function prewarmFaceModels(): void {
  if (loaded || loadPromise) return;
  const start = () => { loadFaceModels().catch(() => { /* swallow — surfaced later */ }); };
  if (typeof window === "undefined") return;
  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof ric === "function") {
    ric(start, { timeout: 2000 });
  } else {
    setTimeout(start, 800);
  }
}
