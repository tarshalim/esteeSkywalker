import { useState } from "react";
import { DEFAULT_AVATAR, avatarFor } from "../../lib/avatars";

/**
 * Round profile picture from public/avatars. Falls back to the
 * default icon if the chosen file fails to load (renamed/removed asset).
 *
 * @param {{ user?: object | null, src?: string, size?: number, className?: string }} props
 */
export default function Avatar({ user, src, size = 36, className = "" }) {
  const wanted = src ?? avatarFor(user).src;
  const [failedSrc, setFailedSrc] = useState(null);
  const shown = failedSrc === wanted ? DEFAULT_AVATAR.src : wanted;
  return (
    <img
      src={shown}
      alt=""
      width={size}
      height={size}
      draggable={false}
      onError={() => shown !== DEFAULT_AVATAR.src && setFailedSrc(wanted)}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
