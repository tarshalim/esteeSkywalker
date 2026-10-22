import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, MapPin, RotateCcw, SwitchCamera, X } from "lucide-react";
import { getCurrentPosition, snapshotVideo } from "../../lib/capture";

function cameraErrorMessage(err) {
  if (err?.name === "NotAllowedError" || err?.name === "SecurityError") return "Camera access was blocked. Allow it in your browser's site settings, or pick a file instead.";
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") return "No camera was found on this device.";
  if (err?.name === "NotReadableError") return "The camera is in use by another app.";
  return `Couldn't start the camera: ${err?.message ?? "unknown error"}`;
}

/** Webcam viewfinder: live preview -> shutter -> review (retake / use). */
export default function CameraModal({ onClose, onUse, onFallbackToFile }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const positionRef = useRef(null); // Promise of the GPS fix, started as soon as the modal opens
  const [facingMode, setFacingMode] = useState("environment");
  const [canFlip, setCanFlip] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [shot, setShot] = useState(null); // { jpeg, url } while reviewing
  const [position, setPosition] = useState(undefined); // undefined = locating, null = unavailable
  const [flash, setFlash] = useState(false);

  // The selfie camera is shown mirrored, like every camera app; snapshots match the preview.
  const mirror = facingMode === "user";

  useEffect(() => {
    positionRef.current = getCurrentPosition();
    positionRef.current.then(setPosition);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setReady(true);
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) setCanFlip(devices.filter((d) => d.kind === "videoinput").length > 1);
      })
      .catch((err) => !cancelled && setError(cameraErrorMessage(err)));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  useEffect(() => () => shot && URL.revokeObjectURL(shot.url), [shot]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const takeShot = async () => {
    try {
      const jpeg = await snapshotVideo(videoRef.current, { mirror });
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
      setShot({ jpeg, url: URL.createObjectURL(jpeg) });
    } catch (err) {
      setError(err.message);
    }
  };

  const usePhoto = async () => onUse({ jpeg: shot.jpeg, position: await positionRef.current });

  const locationLabel =
    position === undefined ? "Locating…" : position ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : "No location — you can set it after";

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/75 p-3 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Take a photo"
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Camera size={16} className="text-blue-300" /> Take photo live
          </h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close camera">
            <X size={16} />
          </button>
        </div>

        <div className="relative aspect-[4/3] w-full bg-black sm:aspect-video">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-contain ${mirror ? "-scale-x-100" : ""} ${shot ? "invisible" : ""}`}
          />
          {shot && <img src={shot.url} alt="Captured photo preview" className="absolute inset-0 h-full w-full object-contain" />}
          {flash && <div className="pointer-events-none absolute inset-0 bg-white/80" />}

          {!ready && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-300">
              <Loader2 size={22} className="animate-spin" /> Starting camera…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-sm text-slate-200" role="alert">
              <p>{error}</p>
              <button type="button" className="rounded-full bg-slate-800 px-4 py-1.5 text-xs font-semibold hover:bg-slate-700" onClick={onFallbackToFile}>
                Choose a photo instead
              </button>
            </div>
          )}

          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm" role="status">
            <MapPin size={12} className={position ? "text-emerald-300" : "text-slate-400"} /> {locationLabel}
          </span>
        </div>

        <div className="flex h-24 items-center justify-between px-6">
          {shot ? (
            <>
              <button type="button" className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-slate-200 hover:bg-slate-800" onClick={() => setShot(null)}>
                <RotateCcw size={16} /> Retake
              </button>
              <button type="button" className="flex items-center gap-1.5 rounded-full bg-blue-400 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-300" onClick={usePhoto}>
                <Check size={16} /> Use photo
              </button>
            </>
          ) : (
            <>
              <span className="w-10" />
              <button
                type="button"
                className="group flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/90 transition disabled:opacity-40"
                onClick={takeShot}
                disabled={!ready}
                aria-label="Take photo"
              >
                <span className="h-12 w-12 rounded-full bg-white transition group-hover:scale-95 group-active:scale-85" />
              </button>
              {canFlip ? (
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-200 hover:bg-slate-800"
                  onClick={() => setFacingMode((m) => (m === "user" ? "environment" : "user"))}
                  aria-label="Switch camera"
                >
                  <SwitchCamera size={18} />
                </button>
              ) : (
                <span className="w-10" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
