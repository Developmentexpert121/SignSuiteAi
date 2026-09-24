import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import * as faceapi from "@vladmandic/face-api";
import { loadFaceModels, areFaceModelsLoaded } from "@/lib/faceModels";

type Status =
  | "loading-models"
  | "requesting-camera"
  | "scanning"
  | "processing"
  | "success"
  | "error";

const FACE_CSS = `
  @keyframes spin-reticle {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes glow-pulse {
    0%,100% { opacity: 0.45; transform: scale(1); }
    50%      { opacity: 0.75; transform: scale(1.08); }
  }
  @keyframes dot1 { 0%,60%,100%{opacity:0.25;transform:scale(0.75)} 30%{opacity:1;transform:scale(1)} }
  @keyframes dot2 { 0%,70%,100%{opacity:0.25;transform:scale(0.75)} 40%{opacity:1;transform:scale(1)} }
  @keyframes dot3 { 0%,80%,100%{opacity:0.25;transform:scale(0.75)} 50%{opacity:1;transform:scale(1)} }
`;

interface FaceLoginUser {
  id: number;
  email: string;
  username: string;
  name: string;
  role: string;
  companyId: number | null;
  apps: string[];
}

interface Props {
  onClose: () => void;
  onSuccess: (user: FaceLoginUser) => void;
}

export default function FaceLockModal({ onClose, onSuccess }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const submitted = useRef(false);

  const initialModelsReady = areFaceModelsLoaded();
  const [status,      setStatus]      = useState<Status>(initialModelsReady ? "requesting-camera" : "loading-models");
  const [headline,    setHeadline]    = useState(initialModelsReady ? "Starting camera…" : "Loading AI models…");
  const [subtitle,    setSubtitle]    = useState(initialModelsReady ? "Please allow camera access" : "Almost ready");
  const [faceFound,   setFaceFound]   = useState(false);
  const [matchedName, setMatchedName] = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [modelsReady, setModelsReady] = useState(initialModelsReady);
  const [cameraReady, setCameraReady] = useState(false);
  const [retryNonce,  setRetryNonce]  = useState(0);

  function stopAll() {
    if (loopRef.current) clearInterval(loopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  /* ── 1. Load face-api models (cached across opens) ─────────── */
  useEffect(() => {
    let cancelled = false;
    loadFaceModels()
      .then(() => { if (!cancelled) setModelsReady(true); })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error("[FaceLock] model load failed:", err);
        if (!cancelled) {
          setStatus("error");
          setHeadline("Failed to load models");
          const detail = err instanceof Error ? err.message : String(err);
          setErrorMsg(detail.slice(0, 240));
        }
      });
    return () => { cancelled = true; stopAll(); };
  }, [retryNonce]);

  /* ── 2. Start camera in PARALLEL with model loading ───────── */
  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
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
        if (!cancelled) setCameraReady(true);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setHeadline("Camera access denied");
          setErrorMsg("Allow camera permission in your browser settings and try again.");
        }
      }
    }
    startCamera();
    return () => { cancelled = true; };
  }, [retryNonce]);

  /* ── 3. Move into "scanning" only when BOTH are ready ─────── */
  useEffect(() => {
    if (modelsReady && cameraReady && status !== "error" && status !== "success" && status !== "processing") {
      setStatus("scanning");
      setHeadline("Scanning your face…");
      setSubtitle("Please look at your device");
    } else if (modelsReady && !cameraReady && status === "loading-models") {
      setStatus("requesting-camera");
      setHeadline("Starting camera…");
      setSubtitle("Please allow camera access");
    }
  }, [modelsReady, cameraReady, status]);

  /* ── 4. Detection loop ────────────────────────────────────── */
  useEffect(() => {
    if (status !== "scanning") return;
    const detectorOpts = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.5,
    });
    loopRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || submitted.current) return;

      const detection = await faceapi
        .detectSingleFace(video, detectorOpts)
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) {
        setFaceFound(false);
        setHeadline("Scanning your face…");
        setSubtitle("Please look at your device");
        return;
      }

      setFaceFound(true);
      setHeadline("Face detected — hold still…");
      setSubtitle("Verifying your identity");

      if (!submitted.current) {
        submitted.current = true;
        await submitDescriptor(Array.from(detection.descriptor));
      }
    }, 250);
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, [status]);

  async function submitDescriptor(descriptor: number[]) {
    if (loopRef.current) clearInterval(loopRef.current);
    setStatus("processing");
    setHeadline("Verifying your identity…");
    setSubtitle("Please wait");
    try {
      const res  = await fetch("/api/auth/face-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setHeadline("Face not recognized");
        setErrorMsg(data.error || "Please use your email and password or contact your admin.");
        return;
      }
      setMatchedName(data.user.name || data.user.username);
      setStatus("success");
      setHeadline("Identity verified!");
      setSubtitle(`Welcome back, ${data.user.name || data.user.username}`);
      setTimeout(() => {
        stopAll();
        onSuccess(data.user);
      }, 1400);
    } catch {
      setStatus("error");
      setHeadline("Connection error");
      setErrorMsg("Please check your network and try again.");
    }
  }

  function handleRetry() {
    stopAll();
    submitted.current = false;
    setStatus("loading-models");
    setHeadline("Initializing…");
    setSubtitle("Loading AI models");
    setFaceFound(false);
    setErrorMsg("");
    setModelsReady(false);
    setRetryNonce(n => n + 1);
  }

  function handleCancel() {
    stopAll();
    onClose();
  }

  const isCamera    = status === "scanning" || status === "processing";
  const isSuccess   = status === "success";
  const isError     = status === "error";
  const isLoading   = status === "loading-models" || status === "requesting-camera";
  const showDots    = status === "scanning" || status === "processing" || isLoading;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "#F5F3EF" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}>

      <style>{FACE_CSS}</style>

      <motion.div
        className="w-full max-w-sm mx-4"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>

        {/* ── White card ───────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl px-8 py-10"
          style={{
            boxShadow: "0 4px 40px rgba(0,0,0,0.07), 0 0 0 1px rgba(232,147,44,0.15)",
          }}>

          {/* Face circle area */}
          <div className="flex justify-center mb-7">
            <div className="relative" style={{ width: 180, height: 180 }}>

              {/* Outer soft gray ring */}
              <div className="absolute"
                style={{
                  inset: -12,
                  borderRadius: "50%",
                  border: "1px solid rgba(0,0,0,0.07)",
                }} />

              {/* Orange radial glow behind */}
              <div className="absolute"
                style={{
                  inset: -8,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(232,147,44,0.22) 0%, transparent 70%)",
                  animation: "glow-pulse 2.2s ease-in-out infinite",
                }} />

              {/* Spinning dashed reticle */}
              <div className="absolute"
                style={{
                  inset: -6,
                  borderRadius: "50%",
                  border: "2px dashed rgba(232,147,44,0.55)",
                  animation: isCamera || isLoading ? "spin-reticle 9s linear infinite" : "none",
                }}>
                {/* Crosshair ticks — N S E W */}
                {/* Top */}
                <div style={{ position: "absolute", top: -7, left: "50%", transform: "translateX(-50%)", width: 2, height: 13, background: "#E8932C", borderRadius: 1 }} />
                {/* Bottom */}
                <div style={{ position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)", width: 2, height: 13, background: "#E8932C", borderRadius: 1 }} />
                {/* Left */}
                <div style={{ position: "absolute", left: -7, top: "50%", transform: "translateY(-50%)", width: 13, height: 2, background: "#E8932C", borderRadius: 1 }} />
                {/* Right */}
                <div style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 13, height: 2, background: "#E8932C", borderRadius: 1 }} />
              </div>

              {/* Camera feed / state circle */}
              <div
                style={{
                  width: 180, height: 180,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "#f3f4f6",
                  position: "relative",
                  zIndex: 1,
                }}>

                {/* Live camera feed */}
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="w-full h-full"
                  style={{
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                    display: isCamera || isSuccess ? "block" : "none",
                  }}
                />

                {/* Loading / idle state — icon placeholder */}
                {!isCamera && !isSuccess && !isError && (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(232,147,44,0.06)" }}>
                    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="26" cy="26" r="25" stroke="rgba(232,147,44,0.2)" strokeWidth="1.5" />
                      <circle cx="26" cy="22" r="9" stroke="rgba(232,147,44,0.45)" strokeWidth="1.5" />
                      <path d="M10 46c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="rgba(232,147,44,0.45)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                )}

                {/* Error state */}
                {isError && (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.05)" }}>
                    <AlertCircle className="w-10 h-10 text-red-400" />
                  </div>
                )}

                {/* Success overlay */}
                {isSuccess && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: "rgba(240,253,244,0.88)" }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
                      <CheckCircle2 className="w-12 h-12 text-green-500" />
                    </motion.div>
                  </motion.div>
                )}

                {/* Processing shimmer overlay */}
                {status === "processing" && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.45)" }}>
                    <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="#E8932C" strokeWidth="3" />
                      <path className="opacity-80" fill="#E8932C" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status text */}
          <div className="text-center mb-4">
            <AnimatePresence mode="wait">
              <motion.h3
                key={headline}
                initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="text-lg font-semibold mb-1"
                style={{ color: isError ? "#ef4444" : isSuccess ? "#16a34a" : "#1C2A3A" }}>
                {headline}
              </motion.h3>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.p
                key={subtitle}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm"
                style={{ color: "#94a3b8" }}>
                {isError ? errorMsg : subtitle}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          {showDots && !isError && (
            <div className="flex items-center justify-center gap-1.5 mb-6">
              <div className="w-2 h-2 rounded-full" style={{ background: "#E8932C", animation: "dot1 1.4s ease-in-out infinite" }} />
              <div className="w-2 h-2 rounded-full" style={{ background: "#E8932C", animation: "dot2 1.4s ease-in-out infinite" }} />
              <div className="w-2 h-2 rounded-full" style={{ background: "#E8932C", animation: "dot3 1.4s ease-in-out infinite" }} />
            </div>
          )}

          {/* Success spacer */}
          {(isSuccess || isError) && <div className="mb-6" />}

          {/* Cancel / Retry button */}
          {!isSuccess && (
            <div className="text-center mb-4">
              {isError ? (
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "rgba(232,147,44,0.1)", color: "#b45309", border: "1px solid rgba(232,147,44,0.25)" }}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
              ) : (
                <button
                  onClick={handleCancel}
                  className="text-sm font-medium transition-colors"
                  style={{ color: "#475569" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#1C2A3A")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#475569")}>
                  Cancel
                </button>
              )}
            </div>
          )}

          {/* Privacy note */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#94a3b8" }} />
            <p className="text-xs" style={{ color: "#94a3b8" }}>
              Your face data is encrypted and never stored externally
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "#f1f5f9", marginBottom: 20 }} />

          {/* Use email instead */}
          <button
            onClick={handleCancel}
            className="w-full flex items-center justify-center gap-2 text-sm transition-colors"
            style={{ color: "#64748b" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#1C2A3A")}
            onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}>
            <ArrowLeft className="w-4 h-4" />
            Use email and password instead
          </button>
        </div>

        {/* Below-card footer */}
        <div className="text-center mt-5 space-y-1">
          <div className="flex items-center justify-center gap-3">
            <Link href="/privacy-policy" className="text-[11px] hover:underline" style={{ color: "#94a3b8" }}>Privacy Policy</Link>
            <span style={{ color: "#d1d5db" }}>·</span>
            <Link href="/terms-of-service" className="text-[11px] hover:underline" style={{ color: "#94a3b8" }}>Terms &amp; Conditions</Link>
          </div>
          <p className="text-[11px]" style={{ color: "#b0b8c8" }}>
            Powered by SignSuiteIQ.ai — AI Built for Signs
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
