import AudioPlayerElementContent from "./AudioPlayerElementContent";
import MusicCardContent from "./MusicCardContent";

/** Music-card skin gets its own layout; pill/cassette/vinyl share the compact player. */
export default function AudioElementContent(props) {
  return props.element.widgetStyle === "card" ? <MusicCardContent {...props} /> : <AudioPlayerElementContent {...props} />;
}
