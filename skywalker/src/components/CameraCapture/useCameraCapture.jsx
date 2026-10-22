import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getCurrentPosition, prepareCapturedPhoto } from "../../lib/capture";
import CameraModal from "./CameraModal";

// Touch-first devices get the OS camera app (better focus/exposure, no extra
// permission prompt); everything else gets the in-app webcam modal.
const prefersNativeCamera = () => window.matchMedia?.("(pointer: coarse)").matches && !window.matchMedia("(hover: hover)").matches;

const hasMediaDevices = () => Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * "Take photo live" for any upload surface. `open()` must run inside the
 * click handler (the native picker needs the user gesture); `element` holds
 * the hidden input / modal and must be rendered. `onCapture(file)` receives a
 * compressed JPEG File whose EXIF already carries the capture time and the
 * browser's GPS fix, so it can go straight into the normal EXIF pipeline.
 *
 * @param {{ onCapture: (file: File) => void|Promise<void>, onError?: (message: string) => void }} opts
 */
export function useCameraCapture({ onCapture, onError }) {
  const inputRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const deliver = useCallback(
    async (raw) => {
      setBusy(true);
      try {
        await onCapture(await prepareCapturedPhoto(raw));
      } catch (err) {
        console.error(err);
        onError?.(`Couldn't use that photo: ${err.message}`);
      } finally {
        setBusy(false);
      }
    },
    [onCapture, onError]
  );

  const open = () => {
    if (prefersNativeCamera() || !hasMediaDevices()) inputRef.current?.click();
    else setModalOpen(true);
  };

  const handleNativeFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Phones often strip GPS from camera-app files handed to the browser; the fix fills that in.
    deliver({ file, position: await getCurrentPosition() });
  };

  const element = (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleNativeFile} />
      {modalOpen &&
        createPortal(
          <CameraModal
            onClose={() => setModalOpen(false)}
            onUse={(raw) => {
              setModalOpen(false);
              deliver(raw);
            }}
            onFallbackToFile={() => {
              setModalOpen(false);
              inputRef.current?.click();
            }}
          />,
          document.body
        )}
    </>
  );

  return { open, busy, element };
}

