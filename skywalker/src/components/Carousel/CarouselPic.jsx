import React, { useState } from 'react';
import Carousel from 'react-bootstrap/Carousel';
import picture1 from '/assets/sil-pictureframe.png';
import picture2 from '/assets/sil-pictureframe02.png';
import picture3 from '/assets/sil-pictureframe03.png';
import picture4 from '/assets/sil-pictureframe04.png';

const CarouselPic = () => {

  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(false);
    setTimeout(() => setIsAnimating(false), 300);
  }

  return (
    <Carousel fade>
      <Carousel.Item>
        <img className="d-block w-100" src={picture1} alt="First slide" />
        <Carousel.Caption>
          <p>Barbie and the magical Bicycles</p>
        </Carousel.Caption>
      </Carousel.Item>

      <Carousel.Item>
        <img className="d-block w-100" src={picture2} alt="Second slide" />
        <Carousel.Caption>
          <p>Egg yolk in the sky? </p>
        </Carousel.Caption>
      </Carousel.Item>

      <Carousel.Item>
        <img className="d-block w-100" src={picture3} alt="Third slide" />
        <Carousel.Caption>
          <p>
            Last day in New Zealand. 
          </p>
        </Carousel.Caption>
      </Carousel.Item>

      <Carousel.Item>
        <img className="d-block w-100" src={picture4} alt="Fourth slide" />
        <Carousel.Caption>
          <p>
            If skies were drawn by Vincent Van Gogh 
          </p>
        </Carousel.Caption>
      </Carousel.Item>

    </Carousel>
  );
}

export default CarouselPic;