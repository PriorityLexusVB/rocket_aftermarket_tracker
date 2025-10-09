import React from 'react';
import Navbar from '../ui/Navbar';

const AppLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* Mobile: Account for bottom navigation, Desktop: Account for top navigation */}
      <main className="pt-16 pb-20 md:pt-16 md:pb-0">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;