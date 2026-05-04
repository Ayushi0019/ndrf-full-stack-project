import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { UserProfile } from './types';

// Import Components
import { ErrorBoundary, LoadingScreen, AlertTicker } from './components/Common';
import { Navbar } from './components/Navbar';
import { Login } from './components/Login';
import { FieldDashboard } from './components/FieldDashboard';
import { HQDashboard } from './components/HQDashboard';

const App = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved user session in localStorage
    const savedUser = localStorage.getItem('ndrf_session');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse session', e);
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (mockUser: UserProfile) => {
    setUser(mockUser);
    localStorage.setItem('ndrf_session', JSON.stringify(mockUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('ndrf_session');
  };

  if (loading) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
          <AlertTicker />
          {user && <Navbar user={user} onLogout={handleLogout} />}
          
          <main className="relative">
            <Routes>
              <Route 
                path="/login" 
                element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} 
              />
              <Route 
                path="/" 
                element={
                  user ? (
                    user.role === 'hq_admin' ? <HQDashboard user={user} /> : <FieldDashboard user={user} />
                  ) : (
                    <Navigate to="/login" />
                  )
                } 
              />
            </Routes>
          </main>
        </div>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
