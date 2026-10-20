import { Check } from "lucide-react";
import { AVATARS } from "../../lib/avatars";
import Avatar from "./Avatar";

/**
 * Grid of the pre-rendered avatars. A radio group, so arrow keys move
 * between options and screen readers announce the selection.
 *
 * @param {{ value: string, onChange: (id: string) => void }} props
 */
export default function AvatarPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Profile picture" className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-3">
      {AVATARS.map((a) => {
        const selected = a.id === value;
        return (
          <label
            key={a.id}
            title={a.label}
            className="relative flex cursor-pointer justify-center rounded-full p-1 transition-transform hover:-translate-y-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-yellow-300"
            style={{ boxShadow: selected ? "0 0 0 3px var(--blue)" : "0 0 0 2px var(--border)" }}
          >
            <input
              type="radio"
              name="avatar"
              value={a.id}
              checked={selected}
              onChange={() => onChange(a.id)}
              className="sr-only"
              aria-label={a.label}
            />
            <Avatar src={a.src} size={56} />
            {selected && (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -bottom-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-white"
                style={{ background: "var(--blue)" }}
              >
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}
