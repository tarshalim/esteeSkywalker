import { ChevronDown } from "lucide-react";
import "./Select.css";

/**
 * The app's one native <select>: a styled wrapper with a centred chevron and
 * optional leading icon. Remaining props (value, onChange, disabled,
 * aria-label, ref, …) go to the <select> itself; pass <option>s as children.
 *
 * @param {{
 *   variant?: "field"|"pill",          // form field (h-10, rounded-xl) or filter pill (h-9, rounded-full)
 *   active?: boolean,                   // pill only: filled blue when a filter is set
 *   icon?: import("react").ComponentType<{ size?: number, className?: string }>,
 *   className?: string,                 // on the wrapper (width, margins, overrides)
 *   style?: import("react").CSSProperties,
 *   children: import("react").ReactNode,
 * } & import("react").SelectHTMLAttributes<HTMLSelectElement>} props
 */
export default function Select({ variant = "field", active = false, icon: Icon, className = "", style, children, ...selectProps }) {
  const classes = ["ui-select", `ui-select--${variant}`, active && "is-active", Icon && "has-icon", className].filter(Boolean).join(" ");
  const iconSize = variant === "pill" ? 14 : 16;
  return (
    <span className={classes} style={style}>
      {Icon && <Icon size={iconSize} className="ui-select-icon" aria-hidden="true" />}
      <select className="ui-select-native" {...selectProps}>
        {children}
      </select>
      <ChevronDown size={iconSize} className="ui-select-chevron" aria-hidden="true" />
    </span>
  );
}
