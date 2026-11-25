import { useEffect, useRef, useState } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "audio[controls]",
  "video[controls]",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Open dialogs, oldest first. Only the last one answers Escape and traps Tab,
// so a dialog opened over another (TripDialog over PinQuickCard) closes alone.
const stack = [];

/**
 * Where Tab should send focus inside a focus trap, or `null` to let the
 * browser move it. `active` is the focused element's index in `focusables`
 * (-1 when focus is outside the dialog).
 *
 * @template T
 * @param {T[]} focusables
 * @param {number} active
 * @param {boolean} backwards - Shift+Tab
 * @returns {?T}
 */
export function trapTarget(focusables, active, backwards) {
  if (focusables.length === 0) return null;
  const last = focusables.length - 1;
  if (active === -1) return backwards ? focusables[last] : focusables[0];
  if (backwards && active === 0) return focusables[last];
  if (!backwards && active === last) return focusables[0];
  return null;
}

const focusablesIn = (el) => [...el.querySelectorAll(FOCUSABLE)].filter((node) => node.getClientRects().length > 0);

/**
 * Shared behaviour for dialogs and popovers. The visuals stay with each
 * component; this adds:
 *   - Escape dismisses the **topmost** open dialog only. The event is
 *     stopped there, so `window` Escape listeners underneath (PinQuickCard)
 *     don't also fire. Escape that a child already handled
 *     (`preventDefault`, e.g. closing a suggestions list) is left alone;
 *   - `locked` (a save or delete in flight) blocks Escape and `dismiss`;
 *   - `modal` dialogs trap Tab inside, move focus in on open when no
 *     `autoFocus` child took it (to the container if it has a `tabIndex`,
 *     else the first control), and hand focus back to whatever had it
 *     before the dialog opened;
 *   - non-modal popovers (`modal: false`) get Escape and focus return only.
 *
 * @param {{ onDismiss: () => void, locked?: boolean, modal?: boolean }} options
 * @returns {{ ref: import("react").RefObject<any>, dismiss: () => void }}
 *   `ref` goes on the dialog panel (not the backdrop); `dismiss` is for the
 *   backdrop and Cancel buttons.
 */
export function useDialog({ onDismiss, locked = false, modal = true }) {
  const ref = useRef(null);
  const latest = useRef({ onDismiss, locked });
  useEffect(() => {
    latest.current = { onDismiss, locked };
  });
  // Read during the first render, before any autoFocus child moves focus.
  const [opener] = useState(() => (typeof document === "undefined" ? null : document.activeElement));

  useEffect(() => {
    const entry = {};
    stack.push(entry);
    const panel = ref.current;

    if (modal && panel && !panel.contains(document.activeElement)) {
      const target = panel.hasAttribute("tabindex") ? panel : focusablesIn(panel)[0];
      target?.focus({ preventScroll: true });
    }

    const onKeyDown = (e) => {
      if (stack.at(-1) !== entry || !ref.current) return;
      if (e.key === "Escape") {
        if (e.defaultPrevented) return;
        e.stopPropagation();
        if (!latest.current.locked) latest.current.onDismiss();
      } else if (e.key === "Tab" && modal) {
        const focusables = focusablesIn(ref.current);
        const target = trapTarget(focusables, focusables.indexOf(document.activeElement), e.shiftKey);
        if (target) {
          e.preventDefault();
          target.focus();
        } else if (focusables.length === 0) {
          e.preventDefault(); // every control is disabled mid-save; keep focus from leaving
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stack.splice(stack.indexOf(entry), 1);
      // Only on a real close: the panel is detached by now, whereas StrictMode's
      // dev replay runs this with it still mounted (and autoFocus inside).
      // And only if focus fell to <body> with it, not if the user moved on.
      if (panel?.isConnected) return;
      const active = document.activeElement;
      const lost = !active || active === document.body;
      if (lost && opener && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [modal, opener]);

  const dismiss = () => {
    if (!latest.current.locked) latest.current.onDismiss();
  };
  return { ref, dismiss };
}
