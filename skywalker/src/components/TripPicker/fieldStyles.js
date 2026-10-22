// Shared form styling for the trip picker, dialogs and upload modal.
// Sized from the --control-* tokens so text inputs match <Select variant="field">.
export const FIELD_INPUT =
  "h-(--control-h) w-full min-w-0 rounded-(--radius-field) border-2 px-(--control-px) text-sm outline-none focus:border-[var(--blue)]";
export const fieldInputStyle = { background: "var(--bg-elevated)", color: "var(--text)", borderColor: "var(--border)" };
export const FIELD_LABEL = "flex min-w-0 flex-col gap-1 text-xs font-semibold";
export const fieldLabelStyle = { color: "var(--text-muted)" };
