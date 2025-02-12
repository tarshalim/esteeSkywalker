import React, { useState, useEffect, useRef } from "react";
import animationUrl from "../../animations/Mum.json";
import lottie from "lottie-web";

const Mum = () => {
    const containerRef = useRef(null);
    const animationInstanceRef = useRef(null);
    const [animationPlaying, setAnimationPlaying] = useState(true);
    const scrollTimeoutRef = useRef(null);
    const speedRef = useRef(1);

    useEffect(() => {
        animationInstanceRef.current = lottie.loadAnimation({
            container: containerRef.current,
            animationData: animationUrl,
            renderer: "svg",
            loop: true,
            autoplay: true,
        });

        const handleScroll = () => {
            // resume animation when scroll
            setAnimationPlaying(true);
            speedRef.current = 1;

            if (scrollTimeoutRef.current) {
                animationInstanceRef.current.setSpeed(1);
                animationInstanceRef.current.play();
            } 

            // clear prev timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            scrollTimeoutRef.current = setTimeout(() => {
                easeOutAnimation();
            }, 200);
        };

        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("scroll", handleScroll);
            animationInstanceRef.current?.destroy();
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, []);

    const easeOutAnimation = () => {
        if (!animationInstanceRef.current) return;

        let speed = speedRef.current;
        const interval = setInterval(() => {
            if (speed > 0.1) {
                speed -= 0.1;
                animationInstanceRef.current.setSpeed(speed);
                speedRef.current = speed;
            } else {
                clearInterval(interval);
                animationInstanceRef.current.pause();
                setAnimationPlaying(false);
            }
        }, 100);
    };


    return (
        <div 
        ref={containerRef}
        style={{ 
            position: "fixed",
            transform: "translate(-50%, -50%) scaleX(-1)",
            overflow: "hidden",
            clipPath: "inset(0px 0px 30px 0px)",
            zIndex: 9999,
            left: "30%",  
            top: "74%",
            width: 400, 
            height: 400,
        }}
    />
    );
};

export default Mum;