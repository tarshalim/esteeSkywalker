import EditableText from "./EditableText";

export default function TextElementContent({ element, editing, actions }) {
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
