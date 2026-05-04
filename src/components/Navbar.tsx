import React from 'react';
import { ShieldAlert, Zap, LogOut } from 'lucide-react';
import { UserProfile } from '../types';

export const Navbar = ({ user, onLogout }: { user: UserProfile, onLogout: () => void }) => {
  const toggleRole = () => {
    const newRole = user.role === 'hq_admin' ? 'field' : 'hq_admin';
    const updatedUser = { ...user, role: newRole };
    localStorage.setItem('ndrf_session', JSON.stringify(updatedUser));
    window.location.reload(); // Simplest way to refresh role state
  };

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <ShieldAlert className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 leading-tight">NDRF</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Resource Management</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <button 
          onClick={toggleRole}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-200"
        >
          <Zap className="w-3 h-3 text-blue-600" />
          Switch to {user.role === 'hq_admin' ? 'Field' : 'HQ'}
        </button>

        <div className="hidden md:flex flex-col items-end">
          <span className="text-sm font-semibold text-gray-900">{user.name}</span>
          <span className="text-xs text-blue-600 font-bold uppercase tracking-tighter">
            {user.role.replace('_', ' ')}
          </span>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};
