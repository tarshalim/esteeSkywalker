import React, { useEffect, useRef } from 'react';
import CarouselPic from '../../components/Carousel/CarouselPic';
import cycling01 from '/assets/Singapore/Cycling01.mp4';
import './Home.css'; 


const Home = () => {
    const videoRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    // if video in view, autoplay
                    videoRef.current.play();
                } else {
                    // pause video when out of view
                    videoRef.current.pause();
                }
            },
            {
                // play video when 80% in view
                threshold: 0.8,
            }
        );

        if (videoRef.current) {
            observer.observe(videoRef.current);
        }

        return () => {
            if (videoRef.current) {
                observer.unobserve(videoRef.current);
            }
        };
    }, []);

    return (
            <main>
                <div className="scrolling-section">
                    <CarouselPic/>
                </div>
                <h1> Singapore </h1>


                <div className="video-section left">
                    <video
                    ref={videoRef}
                    style={{width: "50%"}}
                    height="auto"
                    muted
                    loop
                    preload="auto"
                    className="video"
                    >
                        <source 
                        src={cycling01}
                        type="video/mp4"
                        />
                        </video>
                </div>

                <div className="video-section right">
                    <video
                    ref={videoRef}
                    style={{width: "50%"}}
                    height="auto"
                    muted
                    loop
                    preload="auto"
                    className="video"
                    >
                        <source 
                        src={cycling01}
                        type="video/mp4"
                        />
                    </video>
                </div>

                <div className="video-section left">
                    <video
                    ref={videoRef}
                    style={{width: "50%"}}
                    height="auto"
                    muted
                    loop
                    preload="auto"
                    className="video"
                    >
                        <source 
                        src={cycling01}
                        type="video/mp4"
                        />
                        </video>
                </div>
            
            </main>
                
    );
};
export default Home;