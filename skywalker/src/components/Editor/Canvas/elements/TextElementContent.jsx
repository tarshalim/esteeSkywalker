import EditableText from "./EditableText";

const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" };

export default function TextElementContent({ element, editing, actions }) {
  if (!element.highlight) {
    return (
      <EditableText
        element={element}
        editing={editing}
        actions={actions}
        placeholder="Tap twice to write…"
        className="w-full h-full overflow-hidden px-1"
      />
    );
  }

  // Highlight pill: the text sits on a rounded label that hugs its words.
  return (
    <div className="flex h-full w-full items-start overflow-hidden" style={{ justifyContent: JUSTIFY[element.align] ?? "flex-start" }}>
      <EditableText
        element={element}
        editing={editing}
        actions={actions}
        placeholder="Tap twice to write…"
        className="max-w-full shadow-[0_2px_6px_rgba(15,23,42,0.18)]"
        style={{ background: element.highlight, borderRadius: "0.75em", padding: "0.2em 0.65em", minWidth: "2em" }}
      />
    </div>
  );
}
