import React from 'react';
import { Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

interface ProtectedRouteProps {
  redirectTo: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ redirectTo }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    // Si l'utilisateur n'est pas authentifié, on le redirige vers la page de connexion
    return <Navigate to={redirectTo} replace />;
  }

  // Sinon, on affiche la page demandée
  return <Outlet />;
};

export default ProtectedRoute;
