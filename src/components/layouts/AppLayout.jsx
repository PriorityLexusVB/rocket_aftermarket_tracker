import React from 'react';
import Navbar from '../ui/Navbar';

const AppLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* Mobile: Account for bottom navigation */}
      <main className="pt-0 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;