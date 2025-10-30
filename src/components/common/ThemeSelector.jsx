import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import Icon from '../AppIcon';

const ThemeSelector = ({ className = '' }) => {
  const { currentTheme, changeTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleThemeChange = (themeKey) => {
    changeTheme(themeKey);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Theme Selector Button - Enhanced for mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors duration-200 min-h-[44px] touch-manipulation"
        title="Change Theme Style"
      >
        <Icon name="Palette" size={18} />
        <span className="hidden sm:block">Style</span>
        <Icon name="ChevronDown" size={14} className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown Menu - Mobile optimized */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu - Responsive sizing */}
          <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border-2 border-gray-200 py-2 z-40 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-1">UI Style Presets</h3>
              <p className="text-sm text-gray-600">Choose your preferred interface style</p>
            </div>
            
            {Object.entries(availableThemes)?.map(([key, theme]) => (
              <button
                key={key}
                onClick={() => handleThemeChange(key)}
                className={`w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors duration-150 border-l-4 touch-manipulation min-h-[60px] ${
                  currentTheme === key 
                    ? 'border-l-indigo-500 bg-indigo-50' :'border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-base font-bold text-gray-900">
                        {theme?.name}
                      </h4>
                      {currentTheme === key && (
                        <div className="flex items-center space-x-1 px-2 py-1 bg-indigo-100 rounded-full">
                          <Icon name="Check" size={12} className="text-indigo-600" />
                          <span className="text-xs font-semibold text-indigo-600">Active</span>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {theme?.description}
                    </p>
                  </div>
                  
                  {/* Theme Preview Icons - Added neutral-luxe */}
                  <div className="ml-4 flex flex-col space-y-1">
                    {key === 'default' && (
                      <>
                        <div className="w-4 h-2 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-sm"></div>
                        <div className="w-4 h-2 bg-gradient-to-r from-slate-300 to-indigo-300 rounded-sm"></div>
                        <div className="w-4 h-2 bg-gradient-to-r from-emerald-300 to-green-300 rounded-sm"></div>
                      </>
                    )}
                    {key === 'neutral-luxe' && (
                      <>
                        <div className="w-4 h-2 bg-white border border-gray-300 rounded-sm"></div>
                        <div className="w-4 h-2 bg-gray-50 border border-gray-300 rounded-sm"></div>
                        <div className="w-4 h-2 bg-blue-600 rounded-sm"></div>
                      </>
                    )}
                    {key === 'carded' && (
                      <>
                        <div className="w-4 h-2 bg-white border-2 border-slate-300 rounded-sm shadow-sm"></div>
                        <div className="w-4 h-2 bg-white border-2 border-indigo-300 rounded-sm shadow-sm"></div>
                        <div className="w-4 h-2 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-sm shadow-sm"></div>
                      </>
                    )}
                    {key === 'compact' && (
                      <>
                        <div className="w-4 h-1.5 bg-gray-300 rounded-sm"></div>
                        <div className="w-4 h-1.5 bg-indigo-500 rounded-sm"></div>
                        <div className="w-4 h-1.5 bg-gray-400 rounded-sm"></div>
                      </>
                    )}
                    {key === 'zebra' && (
                      <>
                        <div className="w-4 h-2 bg-white border border-gray-400 rounded-sm"></div>
                        <div className="w-4 h-2 bg-gray-100 border border-gray-400 rounded-sm"></div>
                        <div className="w-4 h-2 bg-white border border-gray-400 rounded-sm"></div>
                      </>
                    )}
                  </div>
                </div>

                {/* Style Features - Added neutral-luxe */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {key === 'default' && (
                    <>
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Gradients</span>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">Premium</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Luxury</span>
                    </>
                  )}
                  {key === 'neutral-luxe' && (
                    <>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">Light</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Mobile-First</span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Dealership</span>
                    </>
                  )}
                  {key === 'carded' && (
                    <>
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">Material</span>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">Elevated</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Clean</span>
                    </>
                  )}
                  {key === 'compact' && (
                    <>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">Dense</span>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full">Efficient</span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Space-Saving</span>
                    </>
                  )}
                  {key === 'zebra' && (
                    <>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">Striped</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Readable</span>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Scannable</span>
                    </>
                  )}
                </div>
              </button>
            ))}

            <div className="px-4 py-3 border-t border-gray-100 mt-2">
              <p className="text-xs text-gray-500">
                💡 Theme preferences are saved automatically and persist across sessions
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ThemeSelector;