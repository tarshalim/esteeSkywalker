import { useEffect, useLayoutEffect, useRef } from "react";
import { textStyle } from "../../../../lib/canvasFonts";

/**
 * Rich-text region used by every text-bearing element (text boxes, notes,
 * polaroid captions, stamps, badges). It is only contentEditable while its
 * element is in edit mode, so a plain press on it still drags the element.
 * Without `actions` it renders read-only.
 */
export default function EditableText({ element, editing, actions, placeholder = "Write something…", className = "", style }) {
  const ref = useRef(null);
  const html = element.html || "";
  const readOnly = !actions;

  // Push external changes (undo, templates) into the DOM, but never while the
  // user is typing — that would reset the caret.
  useLayoutEffect(() => {
    const node = ref.current;
    if (readOnly || !node || node.innerHTML === html) return;
    if (document.activeElement !== node) node.innerHTML = html;
  }, [html, readOnly]);

  useEffect(() => {
    const node = ref.current;
    if (!editing || !node) return;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, [editing]);

  if (readOnly) {
    return <div className={`sb-text ${className}`} style={{ ...textStyle(element), ...style }} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div
      ref={ref}
      className={`sb-text sb-editable ${editing ? "cursor-text select-text" : ""} ${className}`}
      data-placeholder={placeholder}
      contentEditable={editing}
      suppressContentEditableWarning
      style={{ ...textStyle(element), ...style, touchAction: editing ? "auto" : undefined }}
      onPointerDown={editing ? (e) => e.stopPropagation() : undefined}
      onInput={(e) => actions.updateElement(element.id, { html: e.currentTarget.innerHTML }, { coalesce: "text" })}
      // Paste as plain text: keeps foreign styles (and any markup) out of posts.
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    />
  );
}
