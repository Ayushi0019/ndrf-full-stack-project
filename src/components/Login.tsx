import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Zap } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

export const Login = ({ onGuestLogin }: { onGuestLogin: (role: 'hq_admin' | 'field_member') => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const isIframe = window.self !== window.top;

  const handleLogin = async () => {
    console.log('Starting Google Login...');
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log('Google Login Success:', user.email);

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const role = user.email === 'ayushikhatri994@gmail.com' ? 'hq_admin' : 'field_member';
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: user.displayName || 'NDRF Member',
          email: user.email || '',
          role,
          createdAt: serverTimestamp()
        });
      }
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-blocked') {
        setError('The sign-in window was blocked. Please allow pop-ups or click "Open in New Tab" below.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Sign-in was cancelled. Please try again.');
      } else {
        setError(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-orange-600 p-12 text-center">
          <ShieldAlert className="w-20 h-20 text-white mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-2">NDRF Portal</h2>
          <p className="text-orange-100">National Disaster Response Force</p>
        </div>
        <div className="p-10">
          {isIframe && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
              <Zap className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-800 leading-relaxed">
                <p className="font-bold mb-1">Preview Mode Detected</p>
                Google Sign-in works best in a full window. If it fails, use the button below to open the app in a new tab.
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all disabled:opacity-50 mb-4 shadow-lg shadow-gray-200"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                Sign in with Google
              </>
            )}
          </button>

          {isIframe && (
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 text-orange-600 font-bold text-sm hover:bg-orange-50 rounded-xl transition-all border border-dashed border-orange-200 mb-6"
            >
              Open in New Tab to Sign In
            </a>
          )}

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-gray-400 font-bold tracking-widest">Presentation Fallback</span></div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => onGuestLogin('hq_admin')}
              className="flex-1 py-3 px-4 bg-orange-100 text-orange-700 rounded-xl font-bold text-xs hover:bg-orange-200 transition-all"
            >
              Guest Admin
            </button>
            <button
              onClick={() => onGuestLogin('field_member')}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
            >
              Guest Member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
