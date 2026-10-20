import { useEffect, useRef } from "react";

export default function TextElementContent({ element, editable, actions, onSelect }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== element.html) {
      ref.current.innerHTML = element.html || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.id]);

  return (
    <div
      ref={ref}
      className="w-full h-full overflow-auto outline-none"
      data-placeholder="Type something…"
      contentEditable={editable}
      suppressContentEditableWarning
      style={{
        fontSize: element.fontSize,
        color: element.color,
        textAlign: element.align,
        fontWeight: element.fontWeight,
      }}
      onPointerDown={(e) => {
        if (!editable) return;
        onSelect?.(element.id);
        e.stopPropagation();
      }}
      onInput={(e) => actions.updateElement(element.id, { html: e.currentTarget.innerHTML })}
      dangerouslySetInnerHTML={editable ? undefined : { __html: element.html }}
    />
  );
}
