import React, { useState } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-bootstrap';

const ImageUpload = () => {
    const [images, setImages] = useState([]);
    // 1 = editor, 2 = play
    const [mode, setMode] = useState(1);

    const handleImageChange = (event) => {
        const files = Array.from(event.target.files);
        const imageUrls = files.map((file) => URL.createObjectURL(file));
        setImages((prevImages) => [...prevImages, ...imageUrls]);
    };

    // switch editor and play mode
    const handleModeChange = (val) => {
        setMode(val);
    };

    return (
        <div style={{ position: "relative" }}>
            {/* Toggle Button Edit, Play */}
            <ToggleButtonGroup
                type="radio"
                name="options"
                value={mode}
                onChange={handleModeChange}
                style={{
                    position: 'fixed',
                    top: "100px",
                    right: "20px",
                    zIndex: 1000,
                }}
                >
                    <ToggleButton id="tbg-radio-1" value={1}
                    style={{
                        backgroundColor: mode === 1 ? '#f9a800' : 'white',
                        color: mode === 1 ? 'white' : '#f9a800',
                        border: mode === 1 ? 'none' : '2px solid #f9a800',
                        padding: '10px 20px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        boxShadow: mode === 1 ? '0 0 5px rgba(0, 0, 0, 0.3)' : 'none',
                    }}
                    >Editor Mode</ToggleButton>
                    <ToggleButton id="tbg-radio-2" value={2}
                    style={{
                        backgroundColor: mode === 2 ? '#f9a800' : 'white',
                        color: mode === 2 ? 'white' : '#f9a800',
                        border: mode === 2 ? 'none' : '2px solid #f9a800',
                        padding: '10px 20px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        boxShadow: mode === 2 ? '0 0 5px rgba(0, 0, 0, 0.3)' : 'none',
                    }}
                    >Play Mode</ToggleButton>
            </ToggleButtonGroup>

            {/* Image Upload Button */}
            {mode === 1 && (
                <div>
                    <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    id="file-input"
                    style={{ display: "none" }}
                    />

                    <button onClick={() => document.getElementById('file-input').click()}
                    style={{
                        padding: "10px 20px",
                        fontSize: "16px",
                        cursor: "pointer",
                        backgroundColor: "#ff6347",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        boxShadow: "0px 4px 6px rgba(0,0,0,0.1)",
                        position: "fixed",
                        top: "600px",
                        right: "60px",
                    }}
                    >
                        Upload Image
                    </button>
                </div>
            )}

            {/* Display Uploaded Images */}
            <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap" }}>
                {images.map((image, index) => (
                    <img
                    key={index}
                    src={image}
                    alt={`Uploaded ${index + 1}`}
                    style={{ width: '100px', height: '100px', marginBottom: '10px', border: "2px solid #ddd", 
                        objectFit: "cover", }}
                    />
                ))}
            </div>
        </div>
    );
};

export default ImageUpload;
