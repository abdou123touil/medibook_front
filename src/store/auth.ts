import { create } from 'zustand';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'client' | 'doctor';
}

interface AuthState {
  user: User | null;
  setUser: (user: AuthState['user']) => void;
  updateUser: (updates: Partial<AuthState['user']>) => void;
  token: string | null;
  
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
 
  setToken: (token) => {
    localStorage.setItem('token', token || '');
    set({ token, isAuthenticated: !!token });
  },
  setUser: (user) => set({ user }),
  updateUser: (updates) => set((state) => ({
    user: state.user ? { ...state.user, ...updates } : null,
  })),
}));
