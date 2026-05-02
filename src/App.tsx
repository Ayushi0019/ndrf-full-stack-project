import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Initializing Auth Listener...');
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        console.log('User Detected:', firebaseUser.uid, firebaseUser.email);
        
        // Listen to the user document for real-time updates (like role changes)
        unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const profile = { uid: firebaseUser.uid, ...snapshot.data() } as UserProfile;
            console.log('User Profile Updated:', profile.role);
            setUser(profile);
          } else {
            console.warn('Profile not found for user:', firebaseUser.uid);
          }
        }, (err) => {
          console.error('Profile Snapshot Error:', err);
        });

      } else {
        console.log('No Authenticated User.');
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleLogout = async () => {
    console.log('Logging out...');
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50 font-sans selection:bg-orange-100 selection:text-orange-900">
          <AlertTicker />
          {user && <Navbar user={user} onLogout={handleLogout} />}
          
          <main className="relative">
            <Routes>
              <Route 
                path="/login" 
                element={!user ? <Login authError={error} /> : <Navigate to="/" />} 
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
