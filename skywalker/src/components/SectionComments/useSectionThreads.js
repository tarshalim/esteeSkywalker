import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addSectionComment,
  deleteSectionComment,
  flipReaction,
  getSectionComments,
  getSectionReactions,
  toggleSectionReaction,
} from "../../lib/commentStore";
import { useLatestOnly } from "../../hooks/useLatestOnly";

/**
 * Every section's comments and reactions for one post, plus which section's
 * trigger is revealed and whose popover is open (one of each at a time). Off in the editor preview, where the
 * post may not exist yet. `viewerKey` refetches reactions when the reader
 * signs in or out, since "mine" depends on who's asking.
 */
export function useSectionThreads(blogId, { enabled = true, viewerKey = null } = {}) {
  const [comments, setComments] = useState([]);
  const [reactions, setReactions] = useState({});
  const [openId, setOpenId] = useState(null);
  const [revealedId, setRevealedId] = useState(null);

  // A section's action buttons only show once the reader clicks or tabs into
  // that section; anywhere else hides them again. Resolving through
  // .closest() means a click on any child of a section counts as the section.
  useEffect(() => {
    if (!enabled) return;
    const sectionOf = (node) => node?.closest?.("[data-section-id]")?.dataset.sectionId ?? null;
    const reveal = (e) => {
      // Inside the activity bar or popover: keep the current section.
      if (e.target.closest?.(".sc-wrap")) return;
      setRevealedId(sectionOf(e.target));
    };
    // Clicks inside an embed (YouTube, Spotify) never reach this document;
    // all we see is the window losing focus to the iframe.
    let blurTimer;
    const onBlur = () => {
      blurTimer = setTimeout(() => {
        const active = document.activeElement;
        if (active?.tagName === "IFRAME") setRevealedId(sectionOf(active));
      });
    };
    document.addEventListener("pointerdown", reveal);
    document.addEventListener("focusin", reveal);
    window.addEventListener("blur", onBlur);
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener("pointerdown", reveal);
      document.removeEventListener("focusin", reveal);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled]);

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

  // Toggles run one at a time (`toggleChain`) and the counts are reloaded only
  // once none is left in flight (`pendingRef`). Only the newest reload is
  // applied (`beginLoad`), and never while a toggle is pending, so an older
  // response can't overwrite a click the server hasn't seen yet.
  const beginLoad = useLatestOnly();
  const pendingRef = useRef(0);
  const toggleChain = useRef(Promise.resolve());

  const loadReactions = useCallback(() => {
    const isCurrent = beginLoad();
    return getSectionReactions(blogId)
      .then((map) => isCurrent() && pendingRef.current === 0 && setReactions(map))
      .catch((err) => console.error("Failed to load reactions", err));
  }, [blogId, beginLoad]);

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

  // Optimistic: flip it locally, then reconcile with the server's count once
  // every queued toggle has landed. Sending them one at a time matters: two
  // overlapping toggle RPCs for the same emoji both miss the delete and both
  // insert, and the second fails on the primary key.
  const toggleReaction = useCallback(
    (sectionId, emoji) => {
      setReactions((map) => flipReaction(map, sectionId, emoji));
      pendingRef.current += 1;
      const run = toggleChain.current.then(async () => {
        try {
          await toggleSectionReaction(blogId, sectionId, emoji);
        } catch (err) {
          console.error("Failed to toggle reaction", err);
        }
        pendingRef.current -= 1;
        if (pendingRef.current === 0) await loadReactions();
      });
      toggleChain.current = run;
      return run;
    },
    [blogId, loadReactions]
  );

  return { enabled, bySection, reactions, openId, setOpenId, revealedId, addComment, removeComment, toggleReaction };
}
