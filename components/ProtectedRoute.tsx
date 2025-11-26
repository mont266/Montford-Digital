import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        navigate('/login');
      }
    };

    checkSession();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
            navigate('/login');
        }
    });

    return () => subscription.unsubscribe();

  }, [navigate]);
  
  // Render a loading state while checking auth
  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-slate-900 flex justify-center items-center text-white">Loading...</div>;
  }
  
  return isAuthenticated ? <>{children}</> : null;
};

export default ProtectedRoute;