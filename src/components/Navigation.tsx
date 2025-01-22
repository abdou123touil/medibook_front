import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { LogIn, UserCircle, LogOut } from 'lucide-react';
import { AuthModal } from './AuthModal';
import logo from '../assets/img/logo1.png';
export function Navigation() {
  const { user, isAuthenticated, setUser, setToken } = useAuthStore();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    // Vérifier le localStorage au démarrage et mettre à jour l'état d'authentification
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser)); // Mettre à jour l'utilisateur dans le store
      setToken(storedToken); // Mettre à jour le token dans le store
    }
  }, [setUser, setToken]);

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <>
      <nav className="bg-white shadow-lg  ">
        <div className="container mx-auto px-4  ">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold text-indigo-600">
              <img src={logo} alt="Logo" className="w-20 h-19" />
            </Link>

            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to={user?.data?.role === 'doctor' ? '/doctor' : '/client'}
                    className="flex items-center space-x-2 text-gray-700 hover:text-indigo-600"
                  >
                    <UserCircle className="w-5 h-5" />
                    <span>{user?.data.firstName}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Déconnexion</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <LogIn className="w-5 h-5" />
                  <span>Connexion</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
