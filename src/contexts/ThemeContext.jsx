import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const themePresets = {
  default: {
    name: 'Default Premium',
    description: 'Current luxury design with gradients and premium styling',
    classes: {
      // Cards
      card: 'bg-white/80 rounded-3xl shadow-2xl border border-indigo-100 backdrop-blur-sm',
      cardMobile: 'hover:shadow-xl transition-all duration-300 border-l-4 border-l-gradient-to-b from-indigo-500 to-purple-600 bg-gradient-to-br from-white via-slate-50 to-indigo-50 backdrop-blur-sm',
      
      // Buttons  
      button: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-semibold shadow-md',
      buttonOutline: 'border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-700 font-semibold',
      
      // Stats Cards
      statsCard: 'rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-300 border border-white/20 backdrop-blur-sm hover:scale-105',
      
      // Headers
      pageHeader: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 text-white rounded-3xl shadow-2xl border border-white/20 backdrop-blur-sm',
      
      // Tables
      tableContainer: 'bg-white/80 rounded-3xl shadow-2xl border border-indigo-100 overflow-hidden backdrop-blur-sm',
      tableHeader: 'bg-gradient-to-r from-slate-50 via-indigo-50 to-purple-50 border-b border-indigo-200'
    }
  },

  'neutral-luxe': {
    name: 'Neutral Luxe Dealership',
    description: 'Flat, dense, monochrome design with subtle accents for premium dealership feel',
    classes: {
      // Cards - Flat design with minimal shadows
      card: 'bg-white shadow-none border border-gray-300 rounded-md',
      cardMobile: 'bg-white shadow-none border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200',
      
      // Buttons - Solid/outline/ghost only
      button: 'btn btn--primary text-sm font-medium',
      buttonOutline: 'btn btn--ghost text-sm font-medium',
      
      // Stats Cards - Compact KPI style
      statsCard: 'kpi shadow-none',
      
      // Headers - Simple flat headers
      pageHeader: 'bg-gray-800 text-white rounded-md shadow-none border border-gray-700',
      
      // Tables - Clean grid design
      tableContainer: 'table shadow-none',
      tableHeader: 'bg-gray-100 border-b border-gray-300'
    }
  },
  
  carded: {
    name: 'Enhanced Carded',
    description: 'Premium card-based design with enhanced shadows and luxury borders',
    classes: {
      // Cards - Enhanced with luxury materials
      card: 'bg-white rounded-2xl shadow-xl border-2 border-slate-200 hover:border-indigo-300 transition-all duration-300 hover:shadow-2xl',
      cardMobile: 'bg-white rounded-2xl shadow-lg border-2 border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 backdrop-blur-sm',
      
      // Buttons - Material design inspired
      button: 'bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200',
      buttonOutline: 'border-2 border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-all duration-200',
      
      // Stats Cards - Enhanced material elevation
      statsCard: 'rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-slate-100 hover:border-indigo-200 transform hover:-translate-y-1',
      
      // Headers - Refined elegance
      pageHeader: 'bg-gradient-to-r from-slate-800 via-indigo-900 to-slate-800 text-white rounded-2xl shadow-xl border-2 border-slate-700',
      
      // Tables - Clean card-based tables
      tableContainer: 'bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden',
      tableHeader: 'bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200'
    }
  },

  compact: {
    name: 'Compact Pro',
    description: 'Dense, space-efficient design for maximum information density',
    classes: {
      // Cards - Minimal space usage
      card: 'bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200',
      cardMobile: 'bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200',
      
      // Buttons - Streamlined
      button: 'bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all duration-150',
      buttonOutline: 'border border-gray-300 hover:border-indigo-400 hover:bg-gray-50 text-gray-700 hover:text-indigo-600',
      
      // Stats Cards - Compact metrics
      statsCard: 'rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border border-gray-200',
      
      // Headers - Minimal headers
      pageHeader: 'bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-lg shadow-lg',
      
      // Tables - Efficient tables
      tableContainer: 'bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden',
      tableHeader: 'bg-gray-50 border-b border-gray-200'
    }
  },

  zebra: {
    name: 'Zebra Rows',
    description: 'Alternating row patterns for enhanced readability and data scanning',
    classes: {
      // Cards - Striped design elements
      card: 'bg-white rounded-xl shadow-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200',
      cardMobile: 'bg-white rounded-xl shadow-sm border border-gray-300 even:bg-gray-50 hover:bg-blue-50 transition-colors duration-200',
      
      // Buttons - High contrast
      button: 'bg-gray-900 hover:bg-black text-white shadow-md hover:shadow-lg transition-all duration-200',
      buttonOutline: 'border-2 border-gray-400 hover:border-gray-600 hover:bg-gray-100 text-gray-800 hover:text-black',
      
      // Stats Cards - Alternating design
      statsCard: 'rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border-2 border-gray-300 odd:bg-white even:bg-gray-50',
      
      // Headers - Strong contrast
      pageHeader: 'bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white rounded-xl shadow-xl border-2 border-gray-700',
      
      // Tables - Classic zebra striping
      tableContainer: 'bg-white rounded-xl shadow-lg border-2 border-gray-300 overflow-hidden',
      tableHeader: 'bg-gray-100 border-b-2 border-gray-300'
    }
  }
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('neutral-luxe');
  const [themeClasses, setThemeClasses] = useState(themePresets?.['neutral-luxe']?.classes);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme-preset');
    if (savedTheme && themePresets?.[savedTheme]) {
      setCurrentTheme(savedTheme);
      setThemeClasses(themePresets?.[savedTheme]?.classes);
    }
  }, []);

  const changeTheme = (themeKey) => {
    if (themePresets?.[themeKey]) {
      setCurrentTheme(themeKey);
      setThemeClasses(themePresets?.[themeKey]?.classes);
      localStorage.setItem('app-theme-preset', themeKey);
    }
  };

  const value = {
    currentTheme,
    themeClasses,
    changeTheme,
    availableThemes: themePresets
  };

  return (
    <ThemeContext.Provider value={value}>
      <div className={currentTheme === 'neutral-luxe' ? 'theme-neutral-luxe' : ''}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export default ThemeContext;