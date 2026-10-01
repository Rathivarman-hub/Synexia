import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// Premium Color Palettes
const LIGHT_THEME = {
  name: 'light',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  accent: '#2563EB',
  accentLight: '#DBEAFE',
  border: '#E5E7EB',
  hover: '#F3F4F6',
  shadow: 'rgba(0, 0, 0, 0.05)',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

const DARK_THEME = {
  name: 'dark',
  background: '#040810',
  backgroundSecondary: '#0A1120',
  card: '#0E182D',
  text: '#F8FAFC',
  textSecondary: '#E2E8F0',
  accent: '#D1007A',
  accentLight: '#E6008C',
  accentDark: '#002366',
  border: 'rgba(209, 0, 122, 0.25)',
  hover: 'rgba(0, 35, 102, 0.2)',
  shadow: 'rgba(0, 0, 0, 0.6)',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('dark');
  const currentTheme = DARK_THEME;

  useEffect(() => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('data-theme', theme);
    
    // Apply CSS custom properties for global theming
    Object.entries(currentTheme).forEach(([key, value]) => {
      htmlElement.style.setProperty(`--color-${key}`, value);
    });

    localStorage.setItem('techiz-theme', theme);
    
    // Add theme class to body for styling
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);

    // Apply Bootstrap theme
    if (theme === 'dark') {
      document.body.style.backgroundColor = currentTheme.background;
      document.body.style.color = currentTheme.text;
    } else {
      document.body.style.backgroundColor = currentTheme.background;
      document.body.style.color = currentTheme.text;
    }
  }, [theme, currentTheme]);


  const toggleTheme = () => {}; // Disabled
  
  const isDark = theme === 'dark';
  const isLight = theme === 'light';

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        toggleTheme,
        isDark,
        isLight,
        colors: currentTheme,
        lightTheme: LIGHT_THEME,
        darkTheme: DARK_THEME,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

