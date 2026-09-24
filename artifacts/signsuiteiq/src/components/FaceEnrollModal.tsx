import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, RefreshCw, X } from "lucide-react";
import * as faceapi from "@vladmandic/face-api";
import { getUser } from "../lib/auth";
import type { AuthUser } from "../lib/auth";
import { loadFaceModels, areFaceModelsLoaded } from "../lib/faceModels";

type Status =
  | "loading-models"
  | "requesting-camera"
  | "scanning"
  | "processing"
  | "success"
  | "error";

interface Props {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export default function FaceEnrollModal({ onClose, onSuccess }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitted = useRef(false);

  const initialModelsReady = areFaceModelsLoaded();
  const [status, setStatus]   = useState<Status>(initialModelsReady ? "requesting-camera" : "loading-models");
  const [headline, setHead]   = useState(initialModelsReady ? "Starting camera…" : "Loading AI models…");
  const [subtitle, setSub]    = useState(initialModelsReady ? "Please allow camera access" : "Almost ready");
  const [errorMsg, setError]  = useState("");
  const [modelsReady, setMR]  = useState(initialModelsReady);
  const [retryNonce, setRetryNonce] = useState(0);

  function stopAll() {
    if (loopRef.current) clearInterval(loopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadFaceModels()
      .then(() => {
        if (cancelled) return;
        setMR(true);
        setStatus("requesting-camera");
        setHead("Starting camera…");
        setSub("Please allow camera access");
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error("[FaceEnroll] model load failed:", err);
        if (!cancelled) {
          setStatus("error");
          setHead("Failed to load models");
          const detail = err instanceof Error ? err.message : String(err);
          setError(detail.slice(0, 240));
        }
      });
    return () => { cancelled = true; stopAll(); };
  }, [retryNonce]);

  useEffect(() => {
    if (!modelsReady) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("scanning");
        setHead("Position your face in the frame");
        setSub("We'll capture once we get a clear view");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setHead("Camera access denied");
          setError("Allow camera permission in your browser settings and try again.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [modelsReady]);

  useEffect(() => {
    if (status !== "scanning") return;
    const detectorOpts = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.6,
    });
    loopRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || submitted.current) return;
      const detection = await faceapi
        .detectSingleFace(video, detectorOpts)
        .withFaceLandmarks(true)
        .withFaceDescriptor();
      if (!detection) {
        setHead("Position your face in the frame");
        setSub("We'll capture once we get a clear view");
        return;
      }
      submitted.current = true;
      // Capture a small JPEG snapshot of the current frame to store as profile photo.
      const canvas = canvasRef.current;
      let photoDataUrl: string | null = null;
      if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          photoDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        }
      }
      await submit(Array.from(detection.descriptor), photoDataUrl);
    }, 500);
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, [status]);

  async function submit(descriptor: number[], photo: string | null) {
    if (loopRef.current) clearInterval(loopRef.current);
    setStatus("processing");
    setHead("Saving your Face Lock…");
    setSub("Just a moment");
    try {
      const me = getUser();
      const res = await fetch("/api/auth/face-register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(me?.id ? { "X-User-Id": String(me.id) } : {}),
        },
        body: JSON.stringify({ descriptor, photo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setHead("Could not save Face Lock");
        setError(data.error || "Please try again.");
        return;
      }
      setStatus("success");
      setHead("Face Lock enabled!");
      setSub("You can now sign in with your face.");
      setTimeout(() => { stopAll(); onSuccess(data.user); }, 1200);
    } catch {
      setStatus("error");
      setHead("Connection error");
      setError("Please check your network and try again.");
    }
  }

  function retry() {
    stopAll();
    submitted.current = false;
    setStatus("loading-models");
    setHead("Loading AI models…");
    setSub("This only happens once");
    setError("");
    setMR(false);
    setRetryNonce(n => n + 1);
  }

  function close() {
    stopAll();
    onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Set up Face Lock</h2>
          <button onClick={close} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <div className="relative w-64 h-64 rounded-full overflow-hidden bg-gray-100 ring-4 ring-emerald-100">
            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />
            {status === "success" && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/85">
                <CheckCircle2 className="w-20 h-20 text-white" />
              </div>
            )}
            {status === "error" && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-500/85">
                <AlertCircle className="w-20 h-20 text-white" />
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          <h3 className="mt-5 text-base font-semibold text-gray-900 text-center">{headline}</h3>
          <p className="mt-1 text-sm text-gray-600 text-center">{subtitle}</p>
          {errorMsg && <p className="mt-2 text-sm text-red-600 text-center">{errorMsg}</p>}

          <div className="mt-5 flex gap-3">
            {status === "error" && (
              <button onClick={retry} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700">
                <RefreshCw className="w-4 h-4" /> Try again
              </button>
            )}
            {status !== "success" && (
              <button onClick={close} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">
                Cancel
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
