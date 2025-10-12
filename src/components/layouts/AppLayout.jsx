import React from 'react';
import { useState } from 'react';
import Sidebar from '../ui/Sidebar';
import Header from '../ui/Header';

const AppLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleMenuToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col">
        <Header onMenuToggle={handleMenuToggle} />
        <main className="flex-1 p-6 overflow-y-auto overflow-visible">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;