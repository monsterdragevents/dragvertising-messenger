// Stub module for @dragvertising/messenger when package is not available
// This allows the build to succeed even when the messenger package isn't in the repo
import React from 'react';

export const MessengerProvider: React.FC<{ children: React.ReactNode; [key: string]: any }> = ({ children }) => {
  return <>{children}</>;
};

export default {
  MessengerProvider,
};
