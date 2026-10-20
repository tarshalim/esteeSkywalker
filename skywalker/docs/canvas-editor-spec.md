# Blog Post Canvas Editor — Functional Spec & Architecture

Scope: `/blogs/new` and `/blogs/edit/:id` (`src/pages/BlogEditor/BlogEditor.jsx`).

The existing editor is a linear, top-to-bottom content-block editor (`lib/blocks.js` +
`components/Editor/BlockView.jsx`) — text/image/video/textbox blocks stacked in document
flow, reordered via native HTML5 drag-and-drop. It has no freeform positioning, no
undo/redo, no stickers, no audio, no drawing tools.

This spec replaces the **content area** of that page with a freeform canvas engine
("the canvas") while keeping the existing document chrome (Back link, title input,
cover image, location field, template picker, Save Draft / Publish, toast). The header
fields (title/cover/location) stay exactly as they are — the canvas replaces only the
`.editor-blocks` body region.

Posts saved from the new editor are stored as `blog.canvas` (new field) alongside the
existing `blog.blocks` (untouched). `BlogDetail` renders `CanvasReadOnlyView` when
`blog.canvas` is present, else falls back to the legacy `BlockView` list — so existing
seeded posts keep working unmodified.

---

## 1. Data Model

### 1.1 Canvas root (`blog.canvas`)

```ts
CanvasDoc = {
  size: { width: number, height: number },   // px, default A4@96dpi = 794×1123
  theme: {
    pageBg: string,        // page background behind the canvas card
    canvasBg: string,      // canvas surface color
    showGrid: boolean,
    gridSize: number,      // px
    gridColor: string,
    palette: string[],     // quick-swatch presets, user-editable
  },
  elements: CanvasElement[],
  journeyLines: JourneyLine[],
}
```

This is the object that gets **snapshotted for undo/redo** (see §3). Ephemeral UI state
(selection, active tool, zoom, pan, drawer open/closed) lives outside `CanvasDoc` and is
never part of a history entry — undoing a color change must not also un-select an
element or reset the zoom level.

### 1.2 `CanvasElement` (common shape, `lib/canvasElements.js`)

```ts
CanvasElement = {
  id: string,            // "el_<ts36>_<n>"
  kind: "text" | "image" | "video" | "sticker" | "frameSticker" | "audio",
  x: number, y: number,        // top-left, canvas px, unscaled
  width: number, height: number,
  rotation: number,            // degrees
  zIndex: number,               // paint order among elements
  locked?: boolean,
  ...kindFields,
}
```

Kind-specific fields:

| kind | fields |
|---|---|
| `text` | `html, fontSize, color, align, fontWeight` |
| `image` | `src, fit ("cover"\|"contain"), radius` |
| `video` | `url` (normalized via existing `toEmbedUrl`) |
| `sticker` | `stickerId, category ("nature"\|"emoji"), char?, dropShadow` |
| `frameSticker` | `frameId, imageSrc, imageOffsetX, imageOffsetY, imageScale` |
| `audio` | `sourceType ("upload"\|"url"\|"youtube"\|"spotify"), src, title, widgetStyle ("cassette"\|"vinyl"\|"pill"), volume, muted, autoplayOnScroll, accentColor` |

### 1.3 `JourneyLine`

```ts
JourneyLine = {
  id: string,
  points: { x: number, y: number }[],   // ≥2 points, canvas px
  curved: boolean,
  stroke: string,
  strokeWidth: number,
  dashArray: string,        // e.g. "5,5"
  endCap: "airplane" | "pin" | "dot" | "none",
  animated: boolean,        // animated dash-offset
}
```

Journey lines are stored separately from `elements` because they're vertex paths, not
boxes — they don't have `width/height/rotation` transform handles, only draggable
vertices — but they are still part of `CanvasDoc` and still undo/redo-snapshotted.

---

## 2. UI/UX Architecture

### 2.1 Layout regions

```
┌─────────────────────────────────────────────────────────────┐
│ .editor-topbar (existing, unchanged)                         │
│ Back · New Blog Post · Load template… · Save Draft · Publish │
├─────────────────────────────────────────────────────────────┤
│ FloatingToolbar (new, high-contrast dark glass)               │
│ [Select][Text][Image][Video][Sticker▾][Audio][Path] |Undo Redo│ |Theme][Size][Zoom -/100%/+]
├─────────────────────────────────────────────────────────────┤
│  title input / cover / location  (existing, unchanged)        │
│  ┌───────────────────────────────────────────┐  Inspector    │
│  │                                             │  (contextual,│
│  │           CanvasStage ("the paper")         │  right dock, │
│  │  grid overlay · elements · journey lines ·  │  shown only  │
│  │  resize handles (bottom/right/corner)       │  when an     │
│  │                                             │  element is  │
│  └───────────────────────────────────────────┘  selected)    │
│  StickerDrawer (slide-up panel, Nature/Emoji/Frames tabs)     │
└─────────────────────────────────────────────────────────────┘
```

- FloatingToolbar: `fixed`, sits directly under the existing topbar, `bg-slate-900/90
  border border-slate-700 rounded-2xl shadow-2xl backdrop-blur-xl` — Tailwind utilities,
  matching the exact tokens named in the requirements. Active tool gets a
  `bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/40` highlight; disabled Undo/Redo drop
  to `opacity-40 pointer-events-none`.
- CanvasStage keeps the current app convention of a **light paper surface inside a dark
  chrome** (`.editor-canvas` today is `#fdfdfd` on a `radial-gradient` dark page) —
  `theme.canvasBg`/`theme.pageBg` default to that same pairing, user-editable via
  ThemePanel.
- Icons: `lucide-react` (added dependency — the app had no icon library; hand-rolling a
  distinct SVG per tool would be significant duplicated effort for a worse result).

### 2.2 Interaction flows

**Attach-to-cursor spawn (Text/Image/Video/Audio/Sticker).**
1. User clicks a toolbar tool (or a sticker thumbnail in the drawer).
2. A ghost preview of that element type is created and follows `pointermove` (position
   computed from the CanvasStage's bounding rect + current zoom, so it lines up with
   where a click will actually place it).
3. Click inside the stage → `ADD_ELEMENT` at those coordinates, tool reverts to
   `select`, the new element becomes selected with transform handles. Click outside the
   stage, or `Escape`, cancels the spawn.
4. Image/frame-sticker elements place as an empty placeholder that immediately opens a
   file picker; audio places and opens the source picker (upload MP3 or paste a
   URL) since a player needs a source to render.

**Transform (selected element).**
Move: drag body. Resize: 3 handles (bottom, right, corner) with numeric width/height
mirrored in the Inspector. Rotate: a handle above the top edge. Layer: ↑/↓ buttons in
the Inspector (`zIndex` swap with neighbor). Delete: `Delete`/`Backspace` or an ✕
button. **Every drag/resize/rotate only commits one history snapshot on pointer-up**,
not per pointermove frame — otherwise a single drag would blow the 15-entry cap
instantly (see §3.2).

**Journey Line tool.** Click "Path" arms line-draw mode (crosshair cursor, distinct from
element spawn). Each canvas click appends a vertex to the in-progress line, rendered
live. `Enter`/double-click finalizes it (pushes to `journeyLines`, one history commit);
`Escape` discards the in-progress line. A finished line is selectable by clicking the
stroke; its Inspector shows stroke color, thickness, dash pattern, end-cap
(airplane/pin/dot), curved toggle, animated-dashes toggle.

**Sticker Drawer.** Slide-up panel, three tabs — Nature & Travel, Emoji, Frames.
Clicking a thumbnail arms spawn mode for that specific sticker (drawer stays open so
several can be placed in a row). Frame stickers open a file picker on placement; the
placed frame lets the user drag the photo within the mask and scale it via a slider in
the Inspector.

**Theme Panel.** Toggle button opens a popover: page background color, canvas
background color, grid on/off + spacing, and a small editable swatch palette.

**Canvas resize.** Drag handles on the stage's bottom/right/bottom-right edges (pointer
delta → px, following the same pattern as the existing `useResizableWidth` hook in
`BlockView.jsx`), plus two numeric inputs (width/height) in a popover for exact values.
Zoom (25–200%) and pan (space+drag) are separate from the content size — they scale the
*view*, not the document.

### 2.3 Component tree (new files)

```
components/Editor/Canvas/
  CanvasProvider.jsx        context + reducer + history (the store)
  canvasReducer.js
  CanvasWorkspace.jsx       mounts toolbar + stage + drawer + inspector + theme/size popovers
  CanvasStage.jsx           the "paper", grid, spawn-placement + journey-line click capture
  CanvasElement.jsx         generic transform chrome (move/resize/rotate/layer/delete)
  elements/
    TextElementContent.jsx
    ImageElementContent.jsx
    VideoElementContent.jsx
    StickerElementContent.jsx
    FrameStickerElementContent.jsx
    AudioPlayerElementContent.jsx
  JourneyLineLayer.jsx       svg overlay: draw-mode + rendering + selection
  FloatingToolbar.jsx
  StickerDrawer.jsx
  AudioSourceModal.jsx
  ThemePanel.jsx
  CanvasSizeControls.jsx
  InspectorPanel.jsx
  CanvasReadOnlyView.jsx     published/preview renderer (no chrome, responsive scale)
  useSpawnAtCursor.js
lib/
  canvasElements.js          schema + factories
  canvasHistory.js           generic bounded undo/redo stack
  stickers.js                sticker catalog (nature/travel svgs, emoji list, frames)
  journeyLine.js             points→path-d helper (straight/curved), angle-at-end
```

---

## 3. State Management

### 3.1 Store shape (`CanvasProvider`)

Plain React `Context` + `useReducer` — the codebase has no Redux/Zustand and the
existing convention is local `useState` plus Promise-returning localStorage "stores"
(`blogStore.js`); a reducer+context is the smallest idiomatic step up that supports
undo/redo cleanly without adding a state-management dependency.

```ts
State = {
  history: { past: CanvasDoc[], present: CanvasDoc, future: CanvasDoc[] },
  ui: {
    selectedId: string | null,
    activeTool: "select" | "text" | "image" | "video" | "audio" | "sticker" | "journey",
    pendingSticker: StickerRef | null,   // which sticker armed spawn mode
    drawingLine: {x,y}[] | null,          // in-progress journey line
    zoom: number, pan: {x,y},
    drawerOpen: boolean, drawerTab: "nature" | "emoji" | "frames",
    themePanelOpen: boolean, sizePanelOpen: boolean,
  }
}
```

`history.present` is always the live `CanvasDoc`. Everything under `ui` is intentionally
outside the history object.

### 3.2 History stack (`lib/canvasHistory.js`)

```js
createHistory(doc)          → { past: [], present: doc, future: [] }
pushHistory(history, next)  → past.push(present) capped at 15 (shift() drops oldest FIFO);
                               present = next; future = [] (any redo branch is discarded)
undo(history)                → pop last past entry back to present, push old present onto future
redo(history)                → pop first future entry to present, push old present onto past
canUndo = past.length > 0
canRedo = future.length > 0
```

Every **content** mutation goes through `dispatch({ type: "COMMIT", doc: nextDoc })`,
which calls `pushHistory`. Convenience action creators (`addElement`, `updateElement`,
`deleteElement`, `reorderLayer`, `addJourneyPoint`, `finishJourneyLine`,
`setCanvasSize`, `setTheme`) all compute `nextDoc` from `history.present` and dispatch
`COMMIT` — this is the single choke point that guarantees "every action pushes a
snapshot" without every call site re-implementing the cap/FIFO logic.

Drag/resize/rotate are the one deliberate exception: the pointer handlers mutate a
**local transient offset** in `CanvasElement`'s own component state and apply it via
inline `style.transform` on every `pointermove` (no dispatch), and only call
`updateElement` once in `onPointerUp` — so a 300px drag is one history entry, not
hundreds.

### 3.3 Keyboard shortcuts & toolbar wiring

`Ctrl/Cmd+Z` → `UNDO`, `Ctrl+Y` / `Cmd+Shift+Z` → `REDO`, `Delete`/`Backspace` (when an
element is selected and no text input is focused) → `deleteElement`, `Escape` → cancel
spawn/line-draw/deselect. Toolbar Undo/Redo buttons read `canUndo`/`canRedo` directly
off state for their `disabled` prop.

### 3.4 Persistence

`BlogEditor.jsx`'s existing `buildPayload()` gains `canvas: canvasDoc` (the
`history.present` at save time). `lib/blogStore.js` needs no changes — `upsertBlog`
already spreads whatever fields are given onto the stored blog object. Audio files
picked via "upload" are read with the same `FileReader.readAsDataURL` pattern already
used for images/covers, so they persist into the same localStorage-JSON blob without
introducing a new storage mechanism (a real deployment would swap this for the
already-present-but-unused `@aws-sdk/client-s3` upload path — same seam the rest of the
app is waiting on).

---

## 4. Feature-by-feature notes

1. **Audio soundtrack** — `AudioPlayerElementContent` renders one of three widget
   skins (cassette / vinyl / glass pill), each wired to a real `<audio>` element for
   `upload`/`url` sources, or an `<iframe>` for `youtube`/`spotify` (those provide their
   own transport UI, so Play/Pause/Volume/Progress are hidden for embeds — documented
   as a real constraint, not a bug: you cannot script a third-party iframe's playback).
   "Auto-play on scroll into view" uses an `IntersectionObserver` in the read-only
   renderer only (autoplay in the *editor* would be an annoying authoring experience).
2. **Undo/Redo** — covered in §3.2.
3. **Stickers** — `lib/stickers.js` is the single catalog components read from; adding
   a new sticker later means adding one entry there, not touching drawer/element code.
4. **Dynamic canvas** — resize handles + numeric inputs mutate `size` through
   `setCanvasSize` (one history commit on pointer-up, live px values as you drag,
   mirroring `useResizableWidth`); zoom/pan are view-only (§2.2).
5. **Attach-to-mouse spawn** — `useSpawnAtCursor` hook, §2.2.
6. **Toolbar contrast/theming** — Tailwind `slate-900/90` chrome (§2.1) + `ThemePanel`
   for the document's own page/canvas colors — two independent concerns (editor chrome
   theme vs. authored content theme) that must not be conflated.
7. **Journey lines** — `lib/journeyLine.js` + `JourneyLineLayer.jsx`, §2.2.

## 5. Known simplifications (explicit, not accidental)

- Audio "upload" persists as a base64 data URL in localStorage, same ceiling the app
  already accepts for images — fine for a prototype, not for large files in
  production; the spec calls out the S3 seam above.
- Frame-sticker image "crop" is drag-to-reposition + scale slider (pan/zoom within a
  clip mask), not a full freeform crop-shape editor.
- Spotify/YouTube sources are `<iframe>` embeds; there is no OAuth/Web Playback SDK
  integration, so a Spotify embed shows Spotify's own compact player rather than
  the app's custom widget chrome.
