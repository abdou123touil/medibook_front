import { create } from 'zustand';

interface User {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'client' | 'doctor';
  data?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'client' | 'doctor';
  };
}

interface AuthState {
  user: User | null;
  setUser: (user: AuthState['user']) => void;
  updateUser: (updates: Partial<AuthState['user']>) => void;
  token: string | null;
  
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
  pendingRegistration: { email: string; password: string; role: 'client' | 'doctor' } | null;
  setPendingRegistration: (registration: AuthState['pendingRegistration']) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  pendingRegistration: null,

  setPendingRegistration: (pendingRegistration) => set({ pendingRegistration }),
 
  setToken: (token) => {
    localStorage.setItem('token', token || '');
    set({ token, isAuthenticated: !!token });
  },
  setUser: (user) => set({ user }),
  updateUser: (updates) => set((state) => ({
    user: state.user ? { ...state.user, ...updates } : null,
  })),
}));
