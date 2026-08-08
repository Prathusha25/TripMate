import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import MainLayout from './layouts/MainLayout';
import AppRoutes from './routes';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <MainLayout>
            <AppRoutes />
          </MainLayout>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
