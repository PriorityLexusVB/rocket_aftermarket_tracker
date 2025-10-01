import React from 'react';
import Navbar from '../ui/Navbar';

const AppLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="pt-0">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;