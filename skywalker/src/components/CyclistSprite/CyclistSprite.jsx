import { useEffect, useRef } from "react";
import Lottie from "lottie-react";
import animationData from "../../animations/Mum.json";
import "./CyclistSprite.css";

/** Pedaling sprite that speeds up/slows down with scroll activity and flips with direction. */
export default function CyclistSprite({ isMoving, direction }) {
  const lottieRef = useRef(null);

  useEffect(() => {
    const anim = lottieRef.current;
    if (!anim) return;
    anim.setDirection(direction >= 0 ? 1 : -1);
    if (isMoving) {
      anim.setSpeed(1.4);
      anim.play();
    } else {
      anim.setSpeed(1);
      anim.pause();
    }
  }, [isMoving, direction]);

  return (
    <div className={`cyclist-sprite ${direction < 0 ? "is-reversed" : ""}`}>
      <Lottie lottieRef={lottieRef} animationData={animationData} loop autoplay className="cyclist-sprite-anim" />
      <div className="cyclist-sprite-shadow" />
    </div>
  );
}
