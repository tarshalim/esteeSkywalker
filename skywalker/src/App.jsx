import Home from './pages/Home/Home';
import 'bootstrap/dist/css/bootstrap.min.css';
import MapsPage from './pages/MapsPage';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Navbar from "./components/navbar/Navbar";

const App = () => {
  return (
    <Router>
      <Navbar/>

      <Routes>
        {/* redirect first page to home */}
        <Route path="/" element={<Navigate to="/home" />} />
        <Route path="/home" element={<Home />} /> 
        <Route path="/maps" element={<MapsPage />} />
      </Routes>
    </Router>
  );
};

export default App;