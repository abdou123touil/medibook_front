import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'client' | 'doctor'>('client');
  const navigate = useNavigate();
    const { user, isAuthenticated, setUser, setToken } = useAuthStore();
  

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent page reload

    // Store email, password, and role in localStorage for ProfileCompletion
    localStorage.setItem('email', email);
    localStorage.setItem('password', password);
    localStorage.setItem('role', role);

    // Navigate to ProfileCompletion page
    navigate('/profile-completion');
    onClose(); // Close modal after registration
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Make API request to login
      const response = await fetch('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();
      console.log(data)
      
      if (response.ok) {
        // Store user data in localStorage after successful login
        localStorage.setItem('user', JSON.stringify({ data: data.user }));
        localStorage.setItem('token',data.token)
        localStorage.setItem('role',data.user?.role)
        setUser({ data: data.user });
        setToken(data.token);
        console.log(data.user?.role)
        // Navigate to the appropriate dashboard
        navigate(localStorage.getItem('role') === 'doctor' ? '/doctor' : '/client');
        onClose();
      } else {
        console.error('Login failed:', data.message);
        // You can show an error message here for the user
      }
    } catch (error) {
      console.error('Error during login:', error);
      // Show an error message for failed API request
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-6">{mode === 'login' ? 'Connexion' : 'Inscription'}</h2>

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Se connecter
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type d'utilisateur</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'client' | 'doctor')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
            className="text-sm text-indigo-600 hover:underline"
          >
            {mode === 'login' ? "Pas encore inscrit ? S'inscrire" : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}
