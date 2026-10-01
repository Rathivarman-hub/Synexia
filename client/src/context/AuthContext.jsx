import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('techiz-user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const storedUser = user;
    const storedAvatar = localStorage.getItem('techiz-avatar') || '';
    if (!storedUser?.token) {
      setInitializing(false);
      return;
    }

    api.get('/auth/me')
      .then(({ data }) => {
        const refreshedUser = {
          ...data.data,
          avatar: data.data.avatar || storedUser.avatar || storedAvatar,
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
      localStorage.setItem('techiz-user', JSON.stringify(data.data));
      if (data.data.avatar) localStorage.setItem('techiz-avatar', data.data.avatar);
      setUser(data.data);
      return data.data;
    } finally { setLoading(false); }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', payload);
      localStorage.setItem('techiz-user', JSON.stringify(data.data));
      if (data.data.avatar) localStorage.setItem('techiz-avatar', data.data.avatar);
      setUser(data.data);
      return data.data;
    } finally { setLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem('techiz-user');
    localStorage.removeItem('techiz-avatar');
    setUser(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates, avatar: updates.avatar || user?.avatar || '' };
    localStorage.setItem('techiz-user', JSON.stringify(updated));
    if (updated.avatar) localStorage.setItem('techiz-avatar', updated.avatar);
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, initializing, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
