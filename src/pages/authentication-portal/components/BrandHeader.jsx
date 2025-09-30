import React from 'react';
import Icon from '../../../components/AppIcon';

const BrandHeader = () => {
  return (
    <div className="text-center mb-8">
      {/* Logo */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-elevation-2">
          <Icon name="Rocket" size={32} color="white" />
        </div>
      </div>
      
      {/* Brand Name */}
      <h1 className="text-3xl font-bold text-foreground mb-2">
        Rocket Aftermarket
      </h1>
      <p className="text-lg text-muted-foreground mb-1">
        Tracker System
      </p>
      
      {/* Subtitle */}
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Secure access to your aftermarket operations dashboard and vendor management tools
      </p>
      
      {/* Environment Badge */}
      <div className="mt-4 inline-flex items-center px-3 py-1 bg-success/10 border border-success/20 rounded-full">
        <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
        <span className="text-xs font-medium text-success">Production Environment</span>
      </div>
    </div>
  );
};

export default BrandHeader;