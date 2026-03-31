import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
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
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Check for guest session first
    const guestData = sessionStorage.getItem('ndrf_guest_user');
    if (guestData) {
      console.log('Restoring Guest Session...');
      setUser(JSON.parse(guestData));
      setIsGuest(true);
      setLoading(false);
      return;
    }

    console.log('Initializing Auth Listener...');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('Firebase User Detected:', firebaseUser.email);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = { uid: firebaseUser.uid, ...userDoc.data() } as UserProfile;
            console.log('User Profile Loaded:', profile.role);
            setUser(profile);
          } else {
            console.warn('No Firestore profile found for UID:', firebaseUser.uid);
          }
        } catch (err) {
          console.error('Error loading user profile:', err);
        }
      } else {
        console.log('No Authenticated User.');
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGuestLogin = (role: 'hq_admin' | 'field_member') => {
    console.log('Guest Login Triggered:', role);
    const guestUser: UserProfile = {
      uid: `guest_${Math.random().toString(36).substr(2, 9)}`,
      name: `Guest ${role === 'hq_admin' ? 'Admin' : 'Member'}`,
      email: `guest_${role}@ndrf.gov.in`,
      role,
      createdAt: Timestamp.now()
    };
    sessionStorage.setItem('ndrf_guest_user', JSON.stringify(guestUser));
    setUser(guestUser);
    setIsGuest(true);
  };

  const handleLogout = async () => {
    console.log('Logging out...');
    if (isGuest) {
      sessionStorage.removeItem('ndrf_guest_user');
      setIsGuest(false);
      setUser(null);
    } else {
      await signOut(auth);
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
                element={!user ? <Login onGuestLogin={handleGuestLogin} /> : <Navigate to="/" />} 
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
