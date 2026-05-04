import React, { useState } from 'react';
import { ShieldAlert, Users, LayoutDashboard } from 'lucide-react';
import { UserProfile } from '../types';

export const Login = ({ onLogin }: { 
  onLogin: (user: UserProfile) => void 
}) => {
  const [loading, setLoading] = useState(false);

  const handleMockLogin = (role: 'hq_admin' | 'field') => {
    setLoading(true);
    setTimeout(() => {
      const mockUser: UserProfile = {
        uid: role === 'hq_admin' ? 'hq-123' : 'field-456',
        name: role === 'hq_admin' ? 'HQ Commander' : 'Field Responder',
        email: role === 'hq_admin' ? 'admin@ndrf.gov.in' : 'member@ndrf.gov.in',
        role,
        createdAt: new Date().toISOString() as any
      };
      onLogin(mockUser);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-12 text-center">
          <ShieldAlert className="w-20 h-20 text-white mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-2">NDRF Portal</h2>
          <p className="text-blue-100 uppercase tracking-widest text-[10px] font-black">National Disaster Response Force</p>
        </div>
        <div className="p-10 space-y-4">
          <div className="text-center mb-8">
            <h3 className="text-lg font-bold text-gray-900">Mission Access</h3>
            <p className="text-xs text-gray-500">Select your operational role to enter the dashboard</p>
          </div>

          <button
            onClick={() => handleMockLogin('hq_admin')}
            disabled={loading}
            className="w-full flex items-center justify-between gap-3 bg-slate-900 text-white p-5 rounded-2xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 shadow-lg shadow-slate-200 group"
          >
            <div className="flex items-center gap-4">
              <LayoutDashboard className="w-6 h-6 text-blue-400" />
              <div className="text-left">
                <span className="block text-sm">HQ Command</span>
                <span className="block text-[10px] text-slate-400 font-normal">Full resource oversight</span>
              </div>
            </div>
            <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
              <span className="text-xs">→</span>
            </div>
          </button>

          <button
            onClick={() => handleMockLogin('field')}
            disabled={loading}
            className="w-full flex items-center justify-between gap-3 bg-white text-slate-900 border-2 border-slate-100 p-5 rounded-2xl font-bold hover:border-blue-200 hover:bg-blue-50/50 transition-all disabled:opacity-50 group"
          >
            <div className="flex items-center gap-4">
              <Users className="w-6 h-6 text-blue-600" />
              <div className="text-left">
                <span className="block text-sm">Field Unit</span>
                <span className="block text-[10px] text-slate-500 font-normal">Real-time status updates</span>
              </div>
            </div>
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
              <span className="text-xs">→</span>
            </div>
          </button>

          <div className="pt-6 border-t border-slate-100 mt-6 overflow-hidden">
            <p className="text-[9px] text-slate-400 text-center uppercase tracking-widest font-bold">
              Secure Local Instance • No External Data Sync
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
