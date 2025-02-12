import React, { useState } from 'react';
import Button from 'react-bootstrap/Button';
import './Card.css';

const categories = {
  Running: "primary",
  Cycling: "secondary",
  Hiking: "success",
  Driving: "warning",
  Swimming: "danger",
};

const Card = ({ title, thumbnail, category }) => {
  const [view, setViews] = useState(0);
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const handleLike = () => {
    const newLiked = !hasLiked; // toggle like
    setHasLiked(newLiked); 
      setLikes((prevLikes) => (newLiked ? prevLikes + 1 : prevLikes - 1));
  };

  const handleFollow = () => {
    setIsFollowing ((prev) => !prev); // toggle follow
  };
  

  return (
    <div className="custom-card">
          <img className="card-img" src={thumbnail} alt="Thumbnail" />
          <div className="card-body">
            <h5 className="card-title">{title}</h5>

            {/* Follow Button */}
            <Button variant={isFollowing ? "success" : "primary"} onClick={handleFollow}>{isFollowing ? "Following" : "Follow"}</Button>

            {/* Category Tag */}
            <Button variant={categories[category]} className = "mb-2">
              {category}
            </Button>

            {/* View Counter */}
            <button onClick={() => setViews((prevState) => prevState + 1)}>View: {view}</button>

            {/* Likes Counter */}
            <button onClick={handleLike}>Likes: {likes}
              {hasLiked ? "❤️" : "🤍"}
            </button>
          </div>
    </div>

  );
} 
export default Card;