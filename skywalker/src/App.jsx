import { useState } from 'react'
import Home from './pages/Home/Home';
import 'bootstrap/dist/css/bootstrap.min.css';
import MapsPage from './pages/MapsPage';
import Login from './pages/Login';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import Navbar from "./components/navbar/Navbar";
import TripDetail from "./pages/TripDetail/TripDetail";

const App = () => {
  return (
    <Router>
      <Navbar/>

      <Routes>
        <Route path="/home" element={<Home />} /> 
        <Route path="/maps" element={<MapsPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/trip/:tripId" element={<TripDetail />} />
      </Routes>
    </Router>
  );
};

export default App;