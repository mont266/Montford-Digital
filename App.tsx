import React from 'react';
import { Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InvoicePublicPage from './pages/InvoicePublicPage';
import ClientPortalPage from './pages/ClientPortalPage';
import EstimatePublicPage from './pages/EstimatePublicPage';
import EmailPreviewPage from './pages/EmailPreviewPage';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invoice/:id" element={<InvoicePublicPage />} />
      <Route path="/portal/:token" element={<ClientPortalPage />} />
      <Route path="/estimate" element={<EstimatePublicPage />} />
      <Route path="/estimate/:id" element={<EstimatePublicPage />} />
      <Route path="/email-preview" element={<EmailPreviewPage />} />
      <Route 
        path="/dashboard/*" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

export default App;