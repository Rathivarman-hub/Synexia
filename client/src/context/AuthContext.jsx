import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

const avatarStorageKey = (email) => `techiz-avatar:${email.trim().toLowerCase()}`;

const getStoredAvatar = (email) => localStorage.getItem(avatarStorageKey(email)) || '';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('techiz-user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const storedUser = user;
    if (!storedUser?.token) {
      setInitializing(false);
      return;
    }

    const legacyAvatar = localStorage.getItem('techiz-avatar') || '';
    const localAvatar = getStoredAvatar(storedUser.email)
      || (storedUser.avatar?.startsWith('data:image/') ? storedUser.avatar : '')
      || (legacyAvatar.startsWith('data:image/') ? legacyAvatar : '');
    if (localAvatar) localStorage.setItem(avatarStorageKey(storedUser.email), localAvatar);
    localStorage.removeItem('techiz-avatar');

    api.get('/auth/me')
      .then(({ data }) => {
        const refreshedUser = {
          ...data.data,
          avatar: localAvatar || data.data.avatar || storedUser.avatar || '',
          token: storedUser.token,
        };
        localStorage.setItem('techiz-user', JSON.stringify(refreshedUser));
        setUser(refreshedUser);
      })
      .catch(() => {
        localStorage.removeItem('techiz-user');
        setUser(null);
      })
      .finally(() => setInitializing(false));
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      const authenticatedUser = {
        ...data.data,
        avatar: getStoredAvatar(data.data.email) || data.data.avatar || '',
      };
      localStorage.setItem('techiz-user', JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      return authenticatedUser;
    } finally { setLoading(false); }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', payload);
      const authenticatedUser = {
        ...data.data,
        avatar: getStoredAvatar(data.data.email) || data.data.avatar || '',
      };
      localStorage.setItem('techiz-user', JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      return authenticatedUser;
    } finally { setLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem('techiz-user');
    setUser(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates, avatar: updates.avatar || user?.avatar || '' };
    localStorage.setItem('techiz-user', JSON.stringify(updated));
    if (updated.avatar.startsWith('data:image/') && updated.email) {
      localStorage.setItem(avatarStorageKey(updated.email), updated.avatar);
    }
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, initializing, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
