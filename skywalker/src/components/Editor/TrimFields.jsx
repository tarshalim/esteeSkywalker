import { useEffect, useId, useState } from "react";
import { formatTimestamp, parseTimestamp, trimError } from "../../lib/mediaTrim";

const DARK = {
  root: "flex flex-col gap-2",
  row: "flex flex-wrap items-end gap-2",
  field: "flex flex-col gap-1 text-[11px] uppercase tracking-wide text-slate-400",
  input:
    "w-24 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-sm normal-case tracking-normal text-white outline-none focus:border-blue-400 aria-[invalid=true]:border-rose-400",
  loop: "flex items-center gap-1.5 pb-1.5 text-xs text-slate-300",
  error: "m-0 text-xs text-rose-300",
  hint: "m-0 text-[11px] text-slate-400",
};

const LIGHT = {
  root: "editor-trim",
  row: "editor-trim-row",
  field: "editor-trim-field",
  input: "editor-date-input editor-trim-input",
  loop: "editor-range-toggle",
  error: "editor-music-warning",
  hint: "editor-music-note",
};

/**
 * Optional start/end time inputs (m:ss or seconds) plus a loop toggle.
 * `value` is { startSec, endSec, loop }. Edits are reported through
 * onChange({ startSec, endSec, loop }) only while they're valid; onErrorChange
 * gets the current problem (or null) so a parent can block saving. Key it by
 * the media's identity so switching tracks resets the text.
 */
export default function TrimFields({ value, onChange, onErrorChange, showLoop = true, loopLabel = "Loop segment", hint, dark = false }) {
  const id = useId();
  const cls = dark ? DARK : LIGHT;
  const [startText, setStartText] = useState(() => formatTimestamp(value.startSec));
  const [endText, setEndText] = useState(() => formatTimestamp(value.endSec));
  const error = trimError(parseTimestamp(startText), parseTimestamp(endText));

  // Also runs on mount, so a remounted field clears a parent's stale error.
  useEffect(() => {
    onErrorChange?.(error);
  }, [error, onErrorChange]);

  const edit = (nextStart, nextEnd) => {
    setStartText(nextStart);
    setEndText(nextEnd);
    const startSec = parseTimestamp(nextStart);
    const endSec = parseTimestamp(nextEnd);
    if (!trimError(startSec, endSec)) onChange({ startSec, endSec, loop: value.loop });
  };

  // Tidy "135" into "2:15" once the author leaves the field.
  const tidy = () => {
    if (error) return;
    setStartText(formatTimestamp(parseTimestamp(startText)));
    setEndText(formatTimestamp(parseTimestamp(endText)));
  };

  return (
    <div className={cls.root}>
      <div className={cls.row}>
        <label className={cls.field} htmlFor={`${id}-start`}>
          Start time
          <input
            id={`${id}-start`}
            className={cls.input}
            inputMode="decimal"
            placeholder="0:00"
            value={startText}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => edit(e.target.value, endText)}
            onBlur={tidy}
          />
        </label>
        <label className={cls.field} htmlFor={`${id}-end`}>
          End time
          <input
            id={`${id}-end`}
            className={cls.input}
            inputMode="decimal"
            placeholder="End"
            value={endText}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => edit(startText, e.target.value)}
            onBlur={tidy}
          />
        </label>
        {showLoop && (
          <label className={cls.loop}>
            <input
              type="checkbox"
              checked={Boolean(value.loop)}
              onChange={(e) => onChange({ startSec: value.startSec, endSec: value.endSec, loop: e.target.checked })}
            />
            {loopLabel}
          </label>
        )}
      </div>
      {error ? (
        <p className={cls.error} id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : (
        hint && <p className={cls.hint}>{hint}</p>
      )}
    </div>
  );
}
