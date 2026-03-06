import React, { useEffect } from 'react';
import Routes from './Routes';
import { AuthProvider } from './contexts/AuthContext';
import { initializeKeepAlive } from './services/keepAliveService';

function App() {
  // Initialize keep-alive service on mount
  React.useEffect(() => {
    const cleanup = initializeKeepAlive();
    return cleanup;
  }, []);

  return (
    <AuthProvider>
      <Routes />
    </AuthProvider>
  );
}

export default App;
