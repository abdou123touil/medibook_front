import { create } from 'zustand';

interface User {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'client' | 'doctor';
  data?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role: 'client' | 'doctor';
  };
}

interface AuthState {
  user: User | null;
  setUser: (user: AuthState['user']) => void;
  updateUser: (updates: Partial<AuthState['user']>) => void;
  isAuthenticated: boolean;
  pendingRegistration: { email: string; password: string; role: 'client' | 'doctor' } | null;
  setPendingRegistration: (registration: AuthState['pendingRegistration']) => void;
}

function readStoredUser(): User | null {
  try {
    const saved = localStorage.getItem('user');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const data = parsed?.data || parsed;
    const id = data?.id || data?._id;
    if (!id || !data?.role) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('appoiment');
      localStorage.removeItem('cachedReactions');
      return null;
    }
    const safeUser = { data: { id, role: data.role } };
    localStorage.setItem('user', JSON.stringify(safeUser));
    localStorage.removeItem('token');
    localStorage.removeItem('appoiment');
    localStorage.removeItem('cachedReactions');
    return safeUser;
  } catch {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('appoiment');
    localStorage.removeItem('cachedReactions');
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readStoredUser(),
  isAuthenticated: Boolean(readStoredUser()),
  pendingRegistration: null,

  setPendingRegistration: (pendingRegistration) => set({ pendingRegistration }),
 
  setUser: (user) => {
    const data = user?.data || user;
    const id = data?.id || data?._id;
    if (!id || !data?.role) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('appoiment');
      localStorage.removeItem('cachedReactions');
      set({ user: null, isAuthenticated: false });
      return;
    }
    const safeUser = { data: { id, firstName: data.firstName, lastName: data.lastName, email: data.email, role: data.role } };
    localStorage.setItem('user', JSON.stringify({ data: { id, role: data.role } }));
    set({ user: safeUser, isAuthenticated: true });
  },
  updateUser: (updates) => set((state) => ({
    user: state.user ? { ...state.user, ...updates } : null,
  })),
}));
