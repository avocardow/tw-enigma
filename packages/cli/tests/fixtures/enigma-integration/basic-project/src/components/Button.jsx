import React from 'react';

export const PrimaryButton = ({ children, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors"
    >
      {children}
    </button>
  );
};

export const SecondaryButton = ({ children, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
    >
      {children}
    </button>
  );
};

export const Card = ({ title, children }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
};

export const NavigationItem = ({ href, children }) => {
  return (
    <a href={href} className="text-gray-600 hover:text-gray-900">
      {children}
    </a>
  );
};