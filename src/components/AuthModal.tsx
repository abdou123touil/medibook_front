import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { AnimatePresence, motion } from 'framer-motion';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'client' | 'doctor'>('client');
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser, setToken } = useAuthStore();

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
  };

  // Redirection automatique si déjà connecté
  useEffect(() => {
    if (isOpen && isAuthenticated && user?.data?.role) {
      console.log('AuthModal: Redirecting to', user.data.role === 'doctor' ? '/doctor' : '/client');
      navigate(user.data.role === 'doctor' ? '/doctor' : '/client', { replace: true });
      onClose();
    }
  }, [isOpen, isAuthenticated, user?.data?.role, navigate, onClose]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    localStorage.setItem('email', email);
    localStorage.setItem('password', password);
    localStorage.setItem('role', role);

    navigate('/profile-completion');
    onClose();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser({ data: data.user });
        setToken(data.token);
        localStorage.setItem('user', JSON.stringify({ data: data.user }));
        localStorage.setItem('token', data.token);
        localStorage.setItem('appoiment', JSON.stringify({ appoiment: data.appointments }));
        navigate(data.user.role === 'doctor' ? '/doctor' : '/client', { replace: true });
        onClose();
      } else {
        console.error('Échec de connexion:', data.message);
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 dark:bg-gray-900 bg-black bg-opacity-50 flex justify-center items-center"
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <motion.div
          className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-lg w-96"
          variants={modalVariants}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 dark:text-gray-200 text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>

          <h2 className="text-2xl font-bold mb-6">{mode === 'login' ? 'Connexion' : 'Inscription'}</h2>

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-white text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-white text-gray-700 mb-1">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 dark:text-white text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Se connecter
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium dark:text-white text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:text-black rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-white text-gray-700 mb-1">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border dark:text-black border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium dark:text-white text-gray-700 mb-1">Type d'utilisateur</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'client' | 'doctor')}
                  className="w-full px-3 py-2 border dark:text-black border-gray-300 rounded-lg"
                >
                  <option value="client">Client</option>
                  <option value="doctor">Médecin</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                S'inscrire
              </button>
            </form>
          )}

          <div className="text-center mt-4">
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-sm dark:text-white text-indigo-600 hover:underline"
            >
              {mode === 'login' ? "Pas encore inscrit ? S'inscrire" : 'Déjà un compte ? Se connecter'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}