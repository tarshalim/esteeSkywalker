import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Image,
  Film,
  Columns2,
} from "lucide-react";
import "./Toolbar.css";

// `label` (optional) is shown beside the icon from sm up; `title` is always
// the tooltip and accessible name, so icon-only buttons stay understandable.
function ToolbarButton({ icon: Icon, label, title, onRun, active }) {
  return (
    <button
      type="button"
      className={`toolbar-btn ${active ? "is-active" : ""}`}
      title={title}
      aria-label={title}
      // preventDefault on mousedown stops the button from stealing focus away
      // from the contentEditable block, so the text selection survives long
      // enough for document.execCommand to actually act on it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
    >
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}

export default function Toolbar({ onInlineCommand, onSetVariant, onInsertBlock }) {
  return (
    <div className="editor-toolbar glass-panel" role="toolbar" aria-label="Formatting">
      <div className="toolbar-group">
        <ToolbarButton icon={Bold} title="Bold" onRun={() => onInlineCommand("bold")} />
        <ToolbarButton icon={Italic} title="Italic" onRun={() => onInlineCommand("italic")} />
        <ToolbarButton icon={Underline} title="Underline" onRun={() => onInlineCommand("underline")} />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton icon={Heading1} title="Heading 1" onRun={() => onSetVariant("h1")} />
        <ToolbarButton icon={Heading2} title="Heading 2" onRun={() => onSetVariant("h2")} />
        <ToolbarButton icon={Pilcrow} title="Paragraph" onRun={() => onSetVariant("paragraph")} />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton icon={List} title="Bullet list" onRun={() => onInlineCommand("insertUnorderedList")} />
        <ToolbarButton icon={ListOrdered} title="Numbered list" onRun={() => onInlineCommand("insertOrderedList")} />
        <ToolbarButton icon={Quote} title="Insert blockquote" onRun={() => onInsertBlock("quote")} />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <ToolbarButton icon={Image} label="Image" title="Insert image" onRun={() => onInsertBlock("image")} />
        <ToolbarButton icon={Film} label="Video" title="Insert video" onRun={() => onInsertBlock("video")} />
        <ToolbarButton icon={Columns2} label="Text box" title="Insert text box" onRun={() => onInsertBlock("textbox")} />
      </div>
    </div>
  );
}
