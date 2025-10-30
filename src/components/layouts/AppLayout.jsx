import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../ui/Navbar';

const AppLayout = ({ children }) => {
  const location = useLocation();
  
  // Pages that should NOT have the navbar
  const excludeNavbarPaths = ['/guest-claims-submission-form'];
  
  const shouldShowNavbar = !excludeNavbarPaths?.includes(location?.pathname);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Conditionally render Navbar - exclude for guest claims form */}
      {shouldShowNavbar && <Navbar />}
      
      {/* Main content area with proper spacing for top navbar */}
      <main className={`${shouldShowNavbar ? 'pt-16 md:pt-16' : ''}`}>
        {/* Add mobile bottom navigation padding for mobile devices */}
        <div className={`${shouldShowNavbar ? 'pb-20 md:pb-0' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;