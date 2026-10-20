import "./Toolbar.css";

function ToolbarButton({ label, title, onRun, active }) {
  return (
    <button
      type="button"
      className={`toolbar-btn ${active ? "is-active" : ""}`}
      title={title}
      // preventDefault on mousedown stops the button from stealing focus away
      // from the contentEditable block, so the text selection survives long
      // enough for document.execCommand to actually act on it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
    >
      {label}
    </button>
  );
}

export default function Toolbar({ onInlineCommand, onSetVariant, onInsertBlock }) {
  return (
    <div className="editor-toolbar glass-panel">
      <div className="toolbar-group">
        <ToolbarButton label={<strong>B</strong>} title="Bold" onRun={() => onInlineCommand("bold")} />
        <ToolbarButton label={<em>I</em>} title="Italic" onRun={() => onInlineCommand("italic")} />
        <ToolbarButton label={<u>U</u>} title="Underline" onRun={() => onInlineCommand("underline")} />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton label="H1" title="Heading 1" onRun={() => onSetVariant("h1")} />
        <ToolbarButton label="H2" title="Heading 2" onRun={() => onSetVariant("h2")} />
        <ToolbarButton label="¶" title="Paragraph" onRun={() => onSetVariant("paragraph")} />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton label="• List" title="Bullet list" onRun={() => onInlineCommand("insertUnorderedList")} />
        <ToolbarButton label="1. List" title="Numbered list" onRun={() => onInlineCommand("insertOrderedList")} />
        <ToolbarButton label="❝ ❞" title="Insert blockquote" onRun={() => onInsertBlock("quote")} />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton label="🖼 Image" title="Insert image" onRun={() => onInsertBlock("image")} />
        <ToolbarButton label="▶ Video" title="Insert video" onRun={() => onInsertBlock("video")} />
        <ToolbarButton label="▦ Text box" title="Insert text box" onRun={() => onInsertBlock("textbox")} />
      </div>
    </div>
  );
}
