import { ELEMENT_KIND } from "../../../lib/canvasElements";
import TextElementContent from "./elements/TextElementContent";
import ImageElementContent from "./elements/ImageElementContent";
import VideoElementContent from "./elements/VideoElementContent";
import StickerElementContent from "./elements/StickerElementContent";
import FrameStickerElementContent from "./elements/FrameStickerElementContent";
import AudioElementContent from "./elements/AudioElementContent";
import NoteElementContent from "./elements/NoteElementContent";
import PolaroidElementContent from "./elements/PolaroidElementContent";
import ViewfinderElementContent from "./elements/ViewfinderElementContent";
import DecorElementContent from "./elements/DecorElementContent";
import CollageElementContent from "./elements/CollageElementContent";
import "./scrapbook.css";

// One renderer per element kind, shared by the editor, the read-only post
// view and the add-menu previews so all three always look identical.
export const CONTENT_BY_KIND = {
  [ELEMENT_KIND.TEXT]: TextElementContent,
  [ELEMENT_KIND.IMAGE]: ImageElementContent,
  [ELEMENT_KIND.VIDEO]: VideoElementContent,
  [ELEMENT_KIND.STICKER]: StickerElementContent,
  [ELEMENT_KIND.FRAME_STICKER]: FrameStickerElementContent,
  [ELEMENT_KIND.AUDIO]: AudioElementContent,
  [ELEMENT_KIND.NOTE]: NoteElementContent,
  [ELEMENT_KIND.POLAROID]: PolaroidElementContent,
  [ELEMENT_KIND.VIEWFINDER]: ViewfinderElementContent,
  [ELEMENT_KIND.DECOR]: DecorElementContent,
  [ELEMENT_KIND.COLLAGE]: CollageElementContent,
};
