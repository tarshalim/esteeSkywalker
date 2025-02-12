import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Mum from "../../components/cyclists/Mum";
import uploadImage from '/assets/upload-point.png';
import './TripDetail.css';

const cyclistAnimations = {
    1: Mum,
};

const TripDetail = () => {
    {/* Uploading Media */}
    const [uploadPoints, setUploadPoints] = useState([]);
    const [uploadedFiles, setUploadedFiles] = useState({});
    {/* Animation Cyclist */}
    const [progress, setProgress] = useState({ x: 0, y: 50 });
    const [showCyclist, setShowCyclist] = useState(false);
    const [editorMode, setEditorMode] = useState(true);

    const { tripId } = useParams();
    const pathRef = useRef(null);
    const bboxRef = useRef(null);
    const scaleXRef = useRef(1);
    const CyclistComponent = cyclistAnimations[tripId];
    const uploadPointsRef = useRef([]);

    const imageRefs = useRef([]);

    {/* Uploading Media */}
    const handleFileUpload = (pointId, e) => {
        const files = e.target.files;
        const newFiles = Array.from(files).map(file => ({
            url: URL.createObjectURL(file),
            title:"",
            location:"",
            description:"",
        }));
    
        setUploadedFiles(prevFiles => ({
            ...prevFiles, 
            [pointId]: [...(prevFiles[pointId] || []), ...newFiles],
        }));
    };

    const handleInputChange = (pointId, fileIndex, field, value) => {
        setUploadedFiles(prevFiles => {
            const updatedFiles = { ...prevFiles };
            updatedFiles[pointId] = [...updatedFiles[pointId]];
            updatedFiles[pointId][fileIndex] = { 
                ...updatedFiles[pointId][fileIndex],
                [field]: value
            };
            return updatedFiles;
        });
    };

    useEffect(() => {

        const newUploadPoints = [
            { x: 50, y: 50, id: 0 },
            { x: 50, y: 200, id: 1 },
            { x: 50, y: 350, id: 2 },
            { x: 50, y: 500, id: 3 },
            { x: 50, y: 650, id: 4 },
        ];

        setUploadPoints(newUploadPoints);
    }, []);

    {/* Scrolling Cyclist Animation */}
    useEffect(() => {
        setShowCyclist(true);
        // force page to start at the top
        window.scrollTo(0, 0);

        const handleScroll = () => {
            console.log("Scroll event triggered");

            const scrollableHeight = document.body.scrollHeight - window.innerHeight;
            if (scrollableHeight <= 0) {
                return;
            }
            const scrollProgress = window.scrollY / scrollableHeight;
            const slowedProgress = Math.min(1, scrollProgress);

            console.log('Scroll Y:', window.scrollY);
            console.log("Scrollable Height:", scrollableHeight);
            console.log("Scroll Progress:", scrollProgress);
            
            const maxWidth = window.innerWidth;
            const xPosition = slowedProgress * maxWidth;

            setProgress({ x: xPosition, y: 50 });
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // triggering animation when scroll down
    useEffect(() => {
        const options = {
            rootMargin: '0px 0px -200px 0px',
            threshold: 0.5,
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        }, options);

        imageRefs.current.forEach(ref => observer.observe(ref));

        return () => observer.disconnect();
    }, []);

    return (
        <div className="trip-container">
            <h1>Your Trip</h1>
            <p>Category: Your Category</p>

            <button onClick={() => setEditorMode(!editorMode)} className="editor-toggle">
                {editorMode ? "Viewing Mode" : "Editor Mode"}
            </button>

            {/* Upload Points */}
            <div className="upload-points">
                {uploadPoints.map((point, index) => (
                    <div
                    key={point.id}
                    className="upload-point"
                    style={{
                        top: `${50 + (index * 150)}px`,
                        left: index % 2 === 0 ? "50px" : "auto",
                        right: index % 2 !== 0 ? "50px" : "auto",
                        position: "absolute",
                    }}
                    >
                        {uploadedFiles[point.id]?.length > 0 ? (
                            <img
                            src={uploadedFiles[point.id][0].url}
                            alt="Uploaded"
                            className="uploaded-image"
                            />
                    ) : (
                        <div className="upload-icon-container">
                            <img
                            src={uploadImage}
                            alt="Upload Point"
                            className="upload-icon"
                            style={{
                                width: '500px',
                                height: '300px',
                            }}
                        />
                        <input
                            type="file"
                            onChange={(e) => handleFileUpload(point.id, e)}
                            style={{ opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
                        />
                    </div>
                    )}
                </div>
                ))}
            </div>
            {!editorMode && uploadedFiles && Object.keys(uploadedFiles).length > 0 && (
                <div className="trip-images">
                {Object.keys(uploadedFiles).length > 0 ? (
                  Object.entries(uploadedFiles).map(([pointId, files]) => (
                    files.map((fileData, fileIndex) => (
                        <div key={`${pointId}-${fileIndex}`} className="trip-image-container">

                        <img src={fileData.url} alt={`Uploaded ${fileIndex + 1}`} className="uploaded-image" />

                        {/* Image Title */}
                        <input
                            type="text"
                            placeHolder="Title"
                            value={fileData.title}
                            onChange={(e) => handleInputChange(pointId, fileIndex, 'title', e.target.value)}
                        />

                        {/* Image Location */}
                        <div className="location-input">
                            <input
                                type="text"
                                placeholder="Location"
                                value={fileData.location}
                                onChange={(e) => handleInputChange(pointId, fileIndex, 'location', e.target.value)}
                            />
                        </div>

                        {/* Image Description */}
                        <input
                            type="text"
                            placeHolder="Description"
                            value={fileData.description}
                            onChange={(e) => handleInputChange(pointId, fileIndex, 'description', e.target.value)}
                        />
                    </div>
                ))
            ))
        ) : (
            <p>No images uploaded yet. Please upload your trip images.</p>
        )}
        </div>    
        )}
            {showCyclist && CyclistComponent && (
                <div className="cyclist-container"
                    style={{
                    left: `${progress.x}px`,
                    top: `50px`,
                    position: "fixed",
                    transform: "translate(-50%, -50%)",
                    pointerEvents: 'none',
                    }}
                >
                <CyclistComponent progress={progress} loop={true} />
            </div>
            )}
        </div>
    );
};

export default TripDetail;