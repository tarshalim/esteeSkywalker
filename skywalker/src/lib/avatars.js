// Pre-rendered profile pictures in public/avatars/. Files in public/
// can't be globbed at build time, so add new PNGs to this list too.
const AVATAR_FILES = ["female-user.png", "male-user.png", "unknown-user.png"];

/** @typedef {{ id: string, src: string, label: string }} Avatar */

/** @type {Avatar[]} */
export const AVATARS = AVATAR_FILES.map((file) => ({
  id: file.replace(/\.png$/, ""),
  src: `/avatars/${file}`,
  label: file.replace(/\.png$/, "").replace(/-/g, " "),
}));

export const DEFAULT_AVATAR = AVATARS.find((a) => a.id === "unknown-user") ?? AVATARS[0];

/**
 * The avatar stored in the user's metadata, else a stable "random" pick
 * seeded by their id (so it doesn't change on every render or reload), else
 * the default icon for signed-out/unknown users.
 */
export function avatarFor(user) {
  const chosen = AVATARS.find((a) => a.id === user?.user_metadata?.avatar);
  if (chosen) return chosen;
  if (!user?.id) return DEFAULT_AVATAR;
  let hash = 0;
  for (const ch of user.id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATARS[Math.abs(hash) % AVATARS.length];
}
