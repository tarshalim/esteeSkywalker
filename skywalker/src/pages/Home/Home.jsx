import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CarouselPic from '../../components/Carousel/CarouselPic';
import thumbnail1 from '/assets/thumbnail01.jpg';
import thumbnail2 from '/assets/thumbnail02.jpg';
import thumbnail3 from '/assets/thumbnail03.jpg';
import thumbnail4 from '/assets/thumbnail04.jpg';
import './Home.css'; 


const Home = () => {
    const [searchTerm, setSearchTerm] = useState('');

    return (
            <div>
            <CarouselPic/>
            </div>
                
    );
};
export default Home;