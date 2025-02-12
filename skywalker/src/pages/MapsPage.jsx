import React, { useState, useEffect } from "react";
import thumbnail1 from '/assets/thumbnail01.jpg';
import thumbnail2 from '/assets/thumbnail02.jpg';
import ImageUpload from '../components/ImageUpload';
import Mum from "../components/cyclists/Mum";
import "./Mapspage.css";

const MapsPage = () => {
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY; // Get the scroll position
      setScrollPosition(scrollPosition); // Update scroll position state
    };

    window.addEventListener('scroll', handleScroll);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="page-container">
      <div className="upload-button-container">
        <ImageUpload />
      </div>
      
      {/* Background Images */}
      <div
        className="fixed-content"
        style={{
          transform: `translateX(-${scrollPosition * 0.5}px)`, // Adjust this value to control the speed of the movement
        }}
        
      >
        

        <img src={thumbnail2} alt="Scenery 1" className="scenery-image" />
        <img src={thumbnail2} alt="Scenery 2" className="scenery-image" />
        <img src={thumbnail2} alt="Scenery 3" className="scenery-image" />
        <img src={thumbnail2} alt="Scenery 4" className="scenery-image" />
        <img src={thumbnail2} alt="Scenery 4" className="scenery-image" />
        <img src={thumbnail2} alt="Scenery 4" className="scenery-image" />
        <img src={thumbnail2} alt="Scenery 4" className="scenery-image" />
        <img src={thumbnail2} alt="Scenery 4" className="scenery-image" />
      </div>

      <Mum />
      {/* Add a long body with some dummy text */}
      <div className="long-body">
        {[...Array(10)].map((_, index) => (
          <section key={index} className="section">
            <h1>Section {index + 1}</h1>
            <p>This is some text to create a long page. Keep scrolling down!</p>
          </section>
        ))}
      </div>
    </div>
  );
};

export default MapsPage;
