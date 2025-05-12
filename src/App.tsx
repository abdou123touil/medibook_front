import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Home } from './pages/Home';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { ClientDashboard } from './pages/ClientDashboard';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { ProfileCompletion } from './pages/ProfileCompletion';
import { Toaster } from 'react-hot-toast';
import { Chat } from './components/Chat';
import { Statistics } from './pages/Statistics';
import PatientDashboard from './pages/PatientDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { Profile } from './pages/Profile';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
        <Route path="/profile-completion" element={<PageWrapper><ProfileCompletion /></PageWrapper>} />
        
        {/* Chat Route */}
        <Route path="/chat/:appointmentId" element={<PageWrapper><ChatWrapper /></PageWrapper>} />
        <Route element={<ProtectedRoute redirectTo="/" />}>
          {/* Doctor Routes */}
          <Route path="/doctor" element={<PageWrapper><DoctorDashboard /></PageWrapper>} />
          <Route path="/doctor/statistics" element={<PageWrapper><Statistics /></PageWrapper>} />
          {/* Client Routes */}
          <Route path="/client" element={<PageWrapper><ClientDashboard /></PageWrapper>} />
          <Route path="/patient/dashboard" element={<PageWrapper><PatientDashboard /></PageWrapper>} />
          <Route path="/profile" element={<PageWrapper><Profile /></PageWrapper>} />
        </Route>
        <Route path="/login" element={<PageWrapper><div>Page de connexion</div></PageWrapper>} />
        {/* Fallback Route */}
        <Route path="*" element={<PageWrapper><div>404: Page non trouvée</div></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function ChatWrapper() {
  const { appointmentId } = useParams();
  const otherUserId = "67a77f04acae1c44a6191878";
  const otherUserName = "Other User";
  
  return (
    <Chat
      appointmentId={appointmentId!}
      otherUserId={otherUserId}
      otherUserName={otherUserName}
    />
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex flex-col text-gray-900 dark:text-gray-100">
        <Navigation />
        <Toaster position="top-right" reverseOrder={false} />
        <AnimatedRoutes />
        <Footer />
      </div>
    </Router>
  );
}

export default App;