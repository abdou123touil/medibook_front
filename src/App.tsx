import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { ClientDashboard } from './pages/ClientDashboard';
import { Navigation } from './components/Navigation';
import ProtectedRoute from './components/ProtectedRoute'; // Importing ProtectedRoute
import { Footer } from './components/Footer';
import { ProfileCompletion } from './pages/ProfileCompletion';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          
          {/* Profile Completion route */}
          <Route path="/profile-completion" element={<ProfileCompletion />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute redirectTo="/" />}>
            <Route path="/doctor/*" element={<DoctorDashboard />} />
            <Route path="/client/*" element={<ClientDashboard />} />
          </Route>

          {/* Default login page route */}
          <Route path="/login" element={<div>Page de connexion</div>} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
