import { useEffect, useRef } from "react";
import { BLOCK_KIND, toEmbedUrl } from "../../lib/blocks";
import { fileToUrl } from "../../lib/files";
import "./BlockView.css";

const TEXT_TAGS = { h1: "h1", h2: "h2", quote: "blockquote", paragraph: "p" };

function useResizableWidth(width, onResize) {
  const dragRef = useRef(null);

  const startDrag = (e, containerEl) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: width, containerWidth: containerEl.clientWidth };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const onMove = (e) => {
    if (!dragRef.current) return;
    const { startX, startWidth, containerWidth } = dragRef.current;
    const deltaPercent = ((e.clientX - startX) / containerWidth) * 100;
    const next = Math.min(100, Math.max(25, Math.round(startWidth + deltaPercent)));
    onResize(next);
  };
  const onUp = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  return startDrag;
}

function BlockChrome({ editable, dragProps, onDelete, children, extraControls }) {
  if (!editable) return children;
  return (
    <div
      className={`block-chrome ${dragProps?.isDragging ? "is-dragging" : ""}`}
      draggable
      onDragStart={dragProps.onDragStart}
      onDragOver={dragProps.onDragOver}
      onDrop={dragProps.onDrop}
      onDragEnd={dragProps.onDragEnd}
    >
      <div className="block-chrome-bar">
        <span className="block-drag-handle" title="Drag to reorder">
          ⠿
        </span>
        {extraControls}
        <button type="button" className="block-delete-btn" onClick={onDelete} title="Delete block">
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}

export default function BlockView({ block, editable, onChange, onDelete, onFocusBlock, dragProps }) {
  const containerRef = useRef(null);
  const editableRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    if (editableRef.current && editableRef.current.innerHTML !== block.html) {
      editableRef.current.innerHTML = block.html || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  const startResize = useResizableWidth(block.width ?? 100, (w) => onChange({ width: w }));

  if (block.kind === BLOCK_KIND.TEXT) {
    const Tag = TEXT_TAGS[block.variant] || "p";
    return (
      <BlockChrome editable={editable} dragProps={dragProps} onDelete={onDelete}>
        <Tag
          ref={editableRef}
          data-block-id={block.id}
          data-placeholder={block.placeholder}
          className={`block-text block-text-${block.variant}`}
          contentEditable={editable}
          suppressContentEditableWarning
          onFocus={() => onFocusBlock?.(block.id)}
          onInput={(e) => onChange({ html: e.currentTarget.innerHTML })}
          dangerouslySetInnerHTML={editable ? undefined : { __html: block.html }}
        />
      </BlockChrome>
    );
  }

  if (block.kind === BLOCK_KIND.IMAGE) {
    const handlePick = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      onChange({ src: await fileToUrl(file) });
    };
    return (
      <BlockChrome
        editable={editable}
        dragProps={dragProps}
        onDelete={onDelete}
        extraControls={
          editable && (
            <button type="button" className="block-image-pick-btn" onClick={() => imageInputRef.current?.click()}>
              {block.src ? "Change image" : "Choose image"}
            </button>
          )
        }
      >
        <figure className="block-figure" ref={containerRef} style={{ width: `${block.width ?? 100}%` }}>
          {editable && <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handlePick} />}
          {block.src ? (
            <img
              src={block.src}
              alt={block.caption || ""}
              className="block-image"
              onClick={() => editable && imageInputRef.current?.click()}
              style={editable ? { cursor: "pointer" } : undefined}
            />
          ) : (
            <div
              className="block-image-placeholder"
              onClick={() => editable && imageInputRef.current?.click()}
              style={editable ? { cursor: "pointer" } : undefined}
            >
              {editable ? "Click to choose an image" : "No image selected"}
            </div>
          )}
          <figcaption
            className="block-caption"
            contentEditable={editable}
            suppressContentEditableWarning
            onFocus={() => onFocusBlock?.(block.id)}
            onBlur={(e) => onChange({ caption: e.currentTarget.textContent })}
            data-placeholder="Add a caption…"
          >
            {block.caption}
          </figcaption>
          {editable && (
            <div
              className="block-resize-handle"
              onPointerDown={(e) => startResize(e, containerRef.current.parentElement)}
            />
          )}
        </figure>
      </BlockChrome>
    );
  }

  if (block.kind === BLOCK_KIND.VIDEO) {
    const embed = toEmbedUrl(block.url);
    return (
      <BlockChrome
        editable={editable}
        dragProps={dragProps}
        onDelete={onDelete}
        extraControls={
          editable && (
            <input
              className="block-video-url"
              placeholder="Paste a YouTube or video URL…"
              defaultValue={block.url}
              onBlur={(e) => onChange({ url: e.target.value })}
            />
          )
        }
      >
        <div className="block-video" ref={containerRef} style={{ width: `${block.width ?? 100}%` }}>
          {embed ? (
            <iframe
              src={embed}
              title="Embedded video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="block-video-placeholder">Paste a video link above</div>
          )}
          {editable && (
            <div
              className="block-resize-handle"
              onPointerDown={(e) => startResize(e, containerRef.current.parentElement)}
            />
          )}
        </div>
      </BlockChrome>
    );
  }

  if (block.kind === BLOCK_KIND.TEXTBOX) {
    return (
      <BlockChrome
        editable={editable}
        dragProps={dragProps}
        onDelete={onDelete}
        extraControls={
          editable && (
            <div className="block-column-toggle">
              <button
                type="button"
                className={block.columns === 1 ? "is-active" : ""}
                onClick={() => onChange({ columns: 1 })}
              >
                1 col
              </button>
              <button
                type="button"
                className={block.columns === 2 ? "is-active" : ""}
                onClick={() => onChange({ columns: 2 })}
              >
                2 col
              </button>
            </div>
          )
        }
      >
        <div className="block-textbox-wrap" ref={containerRef} style={{ width: `${block.width ?? 100}%` }}>
          <div
            ref={editableRef}
            data-block-id={block.id}
            className="block-textbox"
            style={{ columnCount: block.columns }}
            contentEditable={editable}
            suppressContentEditableWarning
            onFocus={() => onFocusBlock?.(block.id)}
            onInput={(e) => onChange({ html: e.currentTarget.innerHTML })}
            dangerouslySetInnerHTML={editable ? undefined : { __html: block.html }}
          />
          {editable && (
            <div
              className="block-resize-handle"
              onPointerDown={(e) => startResize(e, containerRef.current.parentElement)}
            />
          )}
        </div>
      </BlockChrome>
    );
  }

  return null;
}
