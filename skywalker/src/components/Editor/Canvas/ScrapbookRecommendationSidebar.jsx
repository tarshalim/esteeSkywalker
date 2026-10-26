import { useMemo } from "react";
import { LayoutTemplate, Sparkles } from "lucide-react";
import { Preview } from "./LibraryGrid";
import { LIBRARY_DRAG_TYPE } from "../../../lib/scrapbookLibrary";
import { paperBackground } from "../../../lib/paperStyles";
import { recommendAssets } from "../../../lib/assetRecommender";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

const THUMB = 58;

function Thumbnail({ asset }) {
  // Library factories mint fresh element ids, so build the preview once per asset.
  const element = useMemo(() => asset.item?.create(), [asset]);
  if (element) return <Preview element={element} />;
  if (asset.paperStyle) {
    return <div className="rounded-lg" style={{ width: THUMB, height: THUMB, ...paperBackground({ style: asset.paperStyle }) }} />;
  }
  return (
    <div
      className="flex items-center justify-center rounded-lg text-slate-600"
      style={{ width: THUMB, height: THUMB, ...paperBackground(asset.template?.canvas?.theme?.paper) }}
    >
      <LayoutTemplate size={22} aria-hidden="true" />
    </div>
  );
}

const HEADINGS = {
  keyword: (keywords) => `For “${keywords.slice(0, 3).join("”, “")}”`,
  context: () => "For this trip's vibe",
  default: () => "Popular pieces",
};

/**
 * "Suggested for this story": up to six stickers, frames, textures and
 * templates picked from the words in the post. Recomputes once typing pauses.
 * `onPick(asset)` gets an Asset from lib/assetRecommender — the editor applies
 * it by kind (asset.item / asset.paperStyle / asset.template). Library pieces
 * can also be dragged straight onto the page.
 * @param {{
 *   blogText: string,  // the story body; HTML is fine (see canvasStoryText)
 *   title?: string,
 *   vibes?: string[],  // vibe labels
 *   date?: string,
 *   onPick: (asset: import("../../../lib/assetRecommender").Asset) => void,
 * }} props
 */
export default function ScrapbookRecommendationSidebar({ blogText, title = "", vibes = [], date, onPick }) {
  const text = useDebouncedValue(blogText);
  const settledTitle = useDebouncedValue(title);
  const vibeKey = vibes.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { suggestions, keywords } = useMemo(() => recommendAssets({ title: settledTitle, text, vibes, date }), [settledTitle, text, vibeKey, date]);

  // Tiers fill in order, so the first suggestion's reason describes the panel.
  const reason = suggestions[0]?.reason ?? "default";

  return (
    <aside aria-label="Suggested elements" className="rounded-2xl bg-slate-900/95 p-2 text-slate-200">
      <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <Sparkles size={13} aria-hidden="true" />
        <span className="truncate">{HEADINGS[reason](keywords)}</span>
      </h3>
      <ul className="grid grid-cols-3 gap-1.5">
        {suggestions.map(({ asset, matched }) => (
          <li key={asset.id}>
            {/* Not a <button>: previews render real element content, which contains buttons of its own. */}
            <div
              role="button"
              tabIndex={0}
              draggable={Boolean(asset.item)}
              title={matched.length ? `${asset.label} · matches ${matched.join(", ")}` : asset.label}
              aria-label={asset.label}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-xl p-1 text-[10px] leading-tight text-slate-300 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
              onClick={() => onPick(asset)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(asset);
                }
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData(LIBRARY_DRAG_TYPE, asset.item.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
            >
              <Thumbnail asset={asset} />
              <span className="line-clamp-2 text-center">{asset.template?.name ?? asset.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
