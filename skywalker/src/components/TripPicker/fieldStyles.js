// Shared form styling for the trip picker (TripFields, TripStopsEditor) and the
// BlogFilterBar date popover. Sized from the --control-* tokens so text inputs
// match <Select variant="field">.
export const FIELD_INPUT =
  "h-(--control-h) w-full min-w-0 rounded-(--radius-field) border-2 px-(--control-px) text-sm outline-none focus:border-[var(--blue)]";
export const fieldInputStyle = { background: "var(--bg-elevated)", color: "var(--text)", borderColor: "var(--border)" };
export const FIELD_LABEL = "flex min-w-0 flex-col gap-1 text-xs font-semibold";
export const fieldLabelStyle = { color: "var(--text-muted)" };
// Outlined "+ Add …" pill under a repeating row list (companions, stops).
export const ADD_ROW_BUTTON = "inline-flex h-9 w-fit items-center gap-1.5 rounded-full border-2 px-3 text-xs font-bold disabled:opacity-40";
export const addRowButtonStyle = { borderColor: "var(--border-strong, var(--border))", color: "var(--text-strong, var(--text))" };
