import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addSectionComment,
  deleteSectionComment,
  getSectionComments,
  getSectionReactions,
  toggleSectionReaction,
} from "../../lib/commentStore";

/**
 * Every section's comments and reactions for one post, plus which section's
 * popover is open (only one at a time). Off in the editor preview, where the
 * post may not exist yet. `viewerKey` refetches reactions when the reader
 * signs in or out, since "mine" depends on who's asking.
 */
export function useSectionThreads(blogId, { enabled = true, viewerKey = null } = {}) {
  const [comments, setComments] = useState([]);
  const [reactions, setReactions] = useState({});
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getSectionComments(blogId)
      .then((list) => !cancelled && setComments(list))
      .catch((err) => console.error("Failed to load section comments", err));
    return () => {
      cancelled = true;
    };
  }, [blogId, enabled]);

  const loadReactions = useCallback(
    () =>
      getSectionReactions(blogId)
        .then(setReactions)
        .catch((err) => console.error("Failed to load reactions", err)),
    [blogId]
  );

  useEffect(() => {
    if (enabled) loadReactions();
  }, [enabled, loadReactions, viewerKey]);

  const bySection = useMemo(() => {
    const map = {};
    for (const c of comments) (map[c.sectionId] ??= []).push(c);
    return map;
  }, [comments]);

  const addComment = useCallback(
    async (input) => {
      const comment = await addSectionComment({ blogId, ...input });
      setComments((list) => [...list, comment]);
      return comment;
    },
    [blogId]
  );

  const removeComment = useCallback(async (id) => {
    await deleteSectionComment(id);
    setComments((list) => list.filter((c) => c.id !== id));
  }, []);

  // Optimistic: flip it locally, then reconcile with the server's count.
  const toggleReaction = useCallback(
    async (sectionId, emoji) => {
      setReactions((map) => {
        const section = map[sectionId] ?? {};
        const prev = section[emoji] ?? { count: 0, mine: false };
        const next = { count: Math.max(0, prev.count + (prev.mine ? -1 : 1)), mine: !prev.mine };
        return { ...map, [sectionId]: { ...section, [emoji]: next } };
      });
      try {
        await toggleSectionReaction(blogId, sectionId, emoji);
      } catch (err) {
        console.error("Failed to toggle reaction", err);
      }
      loadReactions();
    },
    [blogId, loadReactions]
  );

  return { enabled, bySection, reactions, openId, setOpenId, addComment, removeComment, toggleReaction };
}
