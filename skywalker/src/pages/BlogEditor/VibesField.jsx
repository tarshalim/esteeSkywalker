import { useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { MAX_VIBE_LABEL, useVibes } from "../../lib/vibes";

/**
 * The post's vibe chips. Click toggles a vibe on the post; "+" adds a new one
 * (selected straight away); the pencil switches to edit mode, where each chip
 * is renamed in place or deleted from the user's list.
 * `value` is the post's selected vibe ids; `onChange` gets the new id list.
 */
export default function VibesField({ value, onChange }) {
  const { vibes, addVibe, renameVibe, deleteVibe } = useVibes();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const commitAdd = () => {
    const id = addVibe(draft);
    if (id && !value.includes(id)) onChange([...value, id]);
    setDraft("");
    setAdding(false);
  };

  const remove = (vibe) => {
    if (!window.confirm(`Delete the vibe “${vibe.label}”? It's removed from all your posts.`)) return;
    deleteVibe(vibe.id);
    if (value.includes(vibe.id)) onChange(value.filter((v) => v !== vibe.id));
  };

  const onKey = (e, commit, cancel) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  return (
    <div className="editor-vibes" role="group" aria-label="Vibe / activity">
      <span className="editor-metadata-label">Vibe</span>
      {vibes.map((o) =>
        editing ? (
          <span key={o.id} className="editor-vibe-chip is-editing">
            <input
              className="editor-vibe-input"
              defaultValue={o.label}
              maxLength={MAX_VIBE_LABEL}
              size={Math.max(o.label.length, 4)}
              aria-label={`Rename ${o.label}`}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value.trim() !== o.label) renameVibe(o.id, e.target.value);
                else e.target.value = o.label;
              }}
              onKeyDown={(e) =>
                onKey(
                  e,
                  () => e.currentTarget.blur(),
                  () => {
                    e.currentTarget.value = o.label;
                    e.currentTarget.blur();
                  }
                )
              }
            />
            <button type="button" className="editor-vibe-icon" aria-label={`Delete ${o.label}`} onClick={() => remove(o)}>
              <X size={12} />
            </button>
          </span>
        ) : (
          <button
            key={o.id}
            type="button"
            className={`editor-vibe-chip${value.includes(o.id) ? " is-on" : ""}`}
            aria-pressed={value.includes(o.id)}
            onClick={() => toggle(o.id)}
          >
            {o.label}
          </button>
        )
      )}
      {adding ? (
        <span className="editor-vibe-chip is-editing">
          <input
            className="editor-vibe-input"
            autoFocus
            value={draft}
            maxLength={MAX_VIBE_LABEL}
            size={Math.max(draft.length, 8)}
            placeholder="New vibe"
            aria-label="New vibe"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitAdd}
            onKeyDown={(e) =>
              onKey(e, commitAdd, () => {
                setDraft("");
                setAdding(false);
              })
            }
          />
        </span>
      ) : (
        <button type="button" className="editor-vibe-chip editor-vibe-tool" aria-label="Add a vibe" title="Add a vibe" onClick={() => setAdding(true)}>
          <Plus size={13} />
        </button>
      )}
      <button
        type="button"
        className={`editor-vibe-chip editor-vibe-tool${editing ? " is-on" : ""}`}
        aria-label={editing ? "Done editing vibes" : "Edit vibes"}
        title={editing ? "Done" : "Edit vibes"}
        aria-pressed={editing}
        onClick={() => setEditing((e) => !e)}
      >
        {editing ? <Check size={13} /> : <Pencil size={13} />}
      </button>
    </div>
  );
}
