import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  createTextBlock,
  createImageBlock,
  createVideoBlock,
  createTextboxBlock,
  makeBlockId,
} from "../../lib/blocks";
import { getBlogById, upsertBlog, getTemplates, getTemplateById, saveTemplate } from "../../lib/blogStore";
import Toolbar from "../../components/Editor/Toolbar";
import BlockView from "../../components/Editor/BlockView";
import CountrySelect from "../../components/CountrySelect/CountrySelect";
import { fileToUrl } from "../../lib/files";
import { extractPhotoMetadata } from "../../lib/exif";
import { useCountriesGeoJson } from "../../hooks/useCountriesGeoJson";
import { findCountryForPoint, continentForCountryCode } from "../../utils/geo";
import { COUNTRY_TO_CONTINENT } from "../../utils/countries";
import "./BlogEditor.css";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function BlogEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [blogId, setBlogId] = useState(id ?? null);
  const [title, setTitle] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [locationName, setLocationName] = useState("");
  const [country, setCountry] = useState(null); // { code, name } | null
  const [postDate, setPostDate] = useState(todayISO());
  const [postDateTouched, setPostDateTouched] = useState(false);
  const countries = useCountriesGeoJson();
  const [blocks, setBlocks] = useState([createTextBlock("paragraph", "")]);
  const [status, setStatus] = useState("draft");
  const [focusedBlockId, setFocusedBlockId] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const draggedIdRef = useRef(null);
  const toastTimer = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    getTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    if (isEditMode) {
      getBlogById(id).then((blog) => {
        if (!blog) return;
        setBlogId(blog.id);
        setTitle(blog.title);
        setCoverImage(blog.coverImage || "");
        setLocationName(blog.location?.name || "");
        setCountry(blog.countryCode ? { code: blog.countryCode, name: blog.countryName || blog.countryCode } : null);
        setPostDate(blog.postDate || blog.date || todayISO());
        setPostDateTouched(true);
        setBlocks(blog.blocks?.length ? blog.blocks : [createTextBlock("paragraph", "")]);
        setStatus(blog.status || "draft");
      });
      return;
    }
    const templateId = searchParams.get("template");
    if (templateId) {
      getTemplateById(templateId).then((tpl) => {
        if (!tpl) return;
        setTitle(tpl.title || "");
        setCoverImage(tpl.coverImage || "");
        setBlocks(tpl.blocks?.length ? tpl.blocks.map((b) => ({ ...b, id: makeBlockId() })) : [createTextBlock("paragraph", "")]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const showToast = (text) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const updateBlock = (blockId, patch) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...patch } : b)));
  };

  const deleteBlock = (blockId) => {
    setBlocks((prev) => (prev.length > 1 ? prev.filter((b) => b.id !== blockId) : prev));
  };

  const insertBlock = (kind) => {
    const factory = {
      quote: () => createTextBlock("quote", ""),
      image: () => createImageBlock("", ""),
      video: () => createVideoBlock(""),
      textbox: () => createTextboxBlock(2, ""),
    }[kind];
    if (!factory) return;
    const newBlock = factory();
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === focusedBlockId);
      if (idx === -1) return [...prev, newBlock];
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      return next;
    });
  };

  const reorderBlocks = (draggedId, targetId) => {
    if (draggedId === targetId) return;
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === draggedId);
      const to = prev.findIndex((b) => b.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const runInlineCommand = (cmd) => {
    document.execCommand(cmd, false, null);
    const active = document.activeElement;
    const id = active?.dataset?.blockId;
    if (id) updateBlock(id, { html: active.innerHTML });
  };

  const setVariant = (variant) => {
    if (!focusedBlockId) return;
    updateBlock(focusedBlockId, { variant });
  };

  const handleCoverPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const [dataUrl, metadata] = await Promise.all([fileToUrl(file), extractPhotoMetadata(file)]);
    setCoverImage(dataUrl);

    // Auto-fill Country/Date from the cover photo's EXIF, but never clobber
    // a value the user already set (manually, from a previous upload, or
    // from loading an existing post).
    const detected = [];
    if (metadata.dateTaken && !postDateTouched) {
      setPostDate(metadata.dateTaken.slice(0, 10));
      detected.push(metadata.dateTaken.slice(0, 10));
    }
    if (metadata.lat != null && metadata.lng != null && !country && countries.length > 0) {
      const match = findCountryForPoint(metadata.lat, metadata.lng, countries);
      if (match) {
        setCountry({ code: match.code, name: match.name });
        detected.push(match.name);
      }
    }
    if (detected.length > 0) {
      showToast(`Detected from cover photo: ${detected.join(", ")} — feel free to change it`);
    }
  };

  const buildPayload = (nextStatus) => ({
    id: blogId ?? undefined,
    title: title.trim() || "Untitled Blog Post",
    coverImage: coverImage || "https://picsum.photos/seed/new-post/1600/900",
    location: { name: locationName.trim() || "Unnamed waypoint" },
    countryCode: country?.code ?? "",
    countryName: country?.name ?? "",
    continent: country ? continentForCountryCode(country.code, countries, COUNTRY_TO_CONTINENT) : "",
    postDate: postDate || todayISO(),
    blocks,
    status: nextStatus,
  });

  const handleSaveDraft = async () => {
    setSaving(true);
    const saved = await upsertBlog(buildPayload("draft"));
    setSaving(false);
    setBlogId(saved.id);
    setStatus("draft");
    showToast("Saved as draft");
    if (!isEditMode) navigate(`/blogs/edit/${saved.id}`, { replace: true });
  };

  const handlePublish = async () => {
    if (!country) {
      showToast("Select a country before publishing");
      return;
    }
    setSaving(true);
    const saved = await upsertBlog(buildPayload("published"));
    setSaving(false);
    navigate(`/blogs/${saved.id}`);
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;
    const tpl = await saveTemplate({ name: templateName.trim(), title, coverImage, blocks });
    setTemplates((prev) => [...prev, tpl]);
    setShowTemplateModal(false);
    setTemplateName("");
    showToast(`Saved layout as “${tpl.name}”`);
  };

  const handleLoadTemplate = async (templateId) => {
    if (!templateId) return;
    if (blocks.some((b) => b.html) && !window.confirm("Replace the current draft with this template?")) return;
    const tpl = await getTemplateById(templateId);
    if (!tpl) return;
    setTitle(tpl.title || "");
    setCoverImage(tpl.coverImage || "");
    setBlocks(tpl.blocks?.length ? tpl.blocks.map((b) => ({ ...b, id: makeBlockId() })) : [createTextBlock("paragraph", "")]);
  };

  return (
    <div className="editor-page">
      <div className="editor-topbar glass-panel">
        <Link to="/blogs" className="editor-back">
          ← Back
        </Link>
        <span className="editor-topbar-label">
          {isEditMode ? `Editing · ${status === "draft" ? "Draft" : "Published"}` : "New Blog Post"}
        </span>
        <div className="editor-actions">
          <select
            className="editor-template-select"
            defaultValue=""
            onChange={(e) => handleLoadTemplate(e.target.value)}
          >
            <option value="" disabled>
              Load template…
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="editor-btn" onClick={() => setShowTemplateModal(true)}>
            Save as Template
          </button>
          <button className="editor-btn" onClick={handleSaveDraft} disabled={saving}>
            Save as Draft
          </button>
          <button className="editor-btn editor-btn-primary" onClick={handlePublish} disabled={saving}>
            Publish
          </button>
        </div>
      </div>

      <Toolbar onInlineCommand={runInlineCommand} onSetVariant={setVariant} onInsertBlock={insertBlock} />

      <div className="editor-canvas">
        <div className="editor-cover" onClick={() => coverInputRef.current?.click()}>
          {coverImage ? <img src={coverImage} alt="Cover" /> : <div className="editor-cover-empty">Click to add a cover image</div>}
          <div className="editor-cover-overlay">Change cover image</div>
          <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverPick} />
        </div>

        <input
          className="editor-title-input"
          placeholder="Untitled Blog Post"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label className="editor-location">
          📍
          <input
            placeholder="Location waypoint (e.g. Hanoi, Vietnam)"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
        </label>

        <div className="editor-metadata">
          <div className="editor-metadata-field">
            <span className="editor-metadata-label">Country</span>
            <CountrySelect value={country} onChange={setCountry} />
          </div>
          <div className="editor-metadata-field">
            <span className="editor-metadata-label">Date</span>
            <input
              type="date"
              className="editor-date-input"
              value={postDate}
              onChange={(e) => {
                setPostDate(e.target.value);
                setPostDateTouched(true);
              }}
            />
          </div>
        </div>

        <div className="editor-blocks" onClick={() => !focusedBlockId && setFocusedBlockId(blocks[blocks.length - 1]?.id)}>
          {blocks.map((block) => (
            <BlockView
              key={block.id}
              block={block}
              editable
              onChange={(patch) => updateBlock(block.id, patch)}
              onDelete={() => deleteBlock(block.id)}
              onFocusBlock={setFocusedBlockId}
              dragProps={{
                onDragStart: () => {
                  draggedIdRef.current = block.id;
                },
                onDragOver: (e) => e.preventDefault(),
                onDrop: () => reorderBlocks(draggedIdRef.current, block.id),
                onDragEnd: () => {
                  draggedIdRef.current = null;
                },
              }}
            />
          ))}
        </div>

        <button className="editor-add-block" onClick={() => setBlocks((prev) => [...prev, createTextBlock("paragraph", "")])}>
          + Add paragraph
        </button>
      </div>

      <AnimatePresence>
        {showTemplateModal && (
          <motion.div className="editor-modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTemplateModal(false)}>
            <motion.div
              className="editor-modal glass-panel"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Save this layout as a template</h3>
              <input
                autoFocus
                placeholder="Template name…"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveAsTemplate()}
              />
              <div className="editor-modal-actions">
                <button onClick={() => setShowTemplateModal(false)}>Cancel</button>
                <button className="editor-btn-primary" onClick={handleSaveAsTemplate}>
                  Save Template
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="editor-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
