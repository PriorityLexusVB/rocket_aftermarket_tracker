import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Bell, User, LogOut, Settings, Calendar, Car, Package, BarChart3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import QuickNavigation from '../common/QuickNavigation';
import ThemeSelector from '../common/ThemeSelector';
import Icon from '../AppIcon';



const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navigationLinks = [
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Vehicles', href: '/vehicles', icon: Car },
    { name: 'Deals', href: '/deals', icon: Package },
    { name: 'Analytics', href: '/executive-analytics-dashboard', icon: BarChart3 },
    { name: 'Admin', href: '/admin', icon: Settings },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActivePath = (path) => {
    return location?.pathname === path || location?.pathname?.startsWith(path + '/');
  };

  return (
    <>
      {/* Mobile Bottom Navigation - Clean and Simple */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="grid grid-cols-4 h-16">
          {navigationLinks?.slice(0, 4)?.map((link) => {
            const Icon = link?.icon;
            const isActive = isActivePath(link?.href);
            return (
              <Link
                key={link?.name}
                to={link?.href}
                className={`flex flex-col items-center justify-center space-y-1 transition-colors duration-200 ${
                  isActive
                    ? 'text-blue-600 bg-blue-50' :'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{link?.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Header Navigation - Clean and Modern */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-3 group">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-md group-hover:bg-blue-700 transition-colors duration-200">
                  <Car className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold text-gray-900">
                    Rocket Aftermarket
                  </span>
                  <span className="text-sm text-gray-500 block">Tracker</span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="flex items-center space-x-1">
              {navigationLinks?.map((link) => {
                const Icon = link?.icon;
                const isActive = isActivePath(link?.href);
                return (
                  <Link
                    key={link?.name}
                    to={link?.href}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200' :'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link?.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-4">
              {/* Quick Navigation */}
              <div className="hidden lg:block">
                <QuickNavigation />
              </div>

              {/* Theme Selector */}
              <div className="hidden lg:block">
                <ThemeSelector />
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-blue-600 transition-colors duration-200 rounded-lg hover:bg-gray-50">
                <Bell className="w-5 h-5" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                  3
                </div>
              </button>

              {/* User Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-3 p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="hidden xl:block text-left">
                    <p className="text-sm font-medium">
                      {userProfile?.full_name || user?.email?.split('@')?.[0] || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {userProfile?.role || 'Staff'}
                    </p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {userProfile?.full_name || 'User'}
                          </p>
                          <p className="text-xs text-gray-500">{user?.email}</p>
                          {userProfile?.role && (
                            <p className="text-xs text-blue-600 capitalize font-medium">{userProfile?.role}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          navigate('/profile');
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors duration-200"
                      >
                        <User className="w-4 h-4 mr-3" />
                        Profile Settings
                      </button>
                      
                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Top Header */}
      <nav className="md:hidden bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Car className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900">
                Rocket Aftermarket
              </span>
              <span className="text-xs text-gray-500 block">Tracker</span>
            </div>
          </Link>

          {/* Mobile Actions */}
          <div className="flex items-center space-x-3">
            {/* Notifications */}
            <button className="relative p-2 text-gray-400 hover:text-blue-600">
              <Bell className="w-5 h-5" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full"></div>
            </button>

            {/* Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-gray-50"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-out Menu */}
        {isMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsMenuOpen(false)}
            />
            <div className="fixed top-16 right-0 w-72 h-full bg-white shadow-xl z-50 overflow-y-auto border-l border-gray-200">
              <div className="p-6">
                {/* User Profile Section */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl mb-6">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {userProfile?.full_name || user?.email?.split('@')?.[0] || 'User'}
                    </p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                    {userProfile?.role && (
                      <p className="text-xs text-blue-600 capitalize font-medium">{userProfile?.role}</p>
                    )}
                  </div>
                </div>

                {/* Theme Selector Mobile */}
                <div className="mb-6">
                  <ThemeSelector className="w-full" />
                </div>

                {/* Navigation Links */}
                <div className="space-y-1 mb-6">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Navigation</h3>
                  {navigationLinks?.map((link) => {
                    const Icon = link?.icon;
                    const isActive = isActivePath(link?.href);
                    return (
                      <Link
                        key={link?.name}
                        to={link?.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' :'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{link?.name}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-6 border-t border-gray-200">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Account</h3>
                  
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate('/profile');
                    }}
                    className="flex items-center w-full space-x-3 px-3 py-3 text-sm text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors duration-200"
                  >
                    <User className="w-5 h-5" />
                    <span>Profile Settings</span>
                  </button>
                  
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full space-x-3 px-3 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Click outside to close dropdowns */}
      {isProfileOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setIsProfileOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;