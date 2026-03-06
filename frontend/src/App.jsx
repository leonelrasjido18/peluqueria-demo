import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import BookingPage from './pages/BookingPage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          {/* Public Landing Presentation */}
          <Route path="/" element={<LandingPage />} />

          {/* Booking flow */}
          <Route path="/reserva" element={<BookingPage />} />

          {/* Auth Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Route (simplified for design phase) */}
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
