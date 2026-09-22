import React, { useState } from 'react';
import { X, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, Sparkles } from 'lucide-react';
import { BhawaniLogo } from './BhawaniLogo';
import { User, UserRole } from '../types';
import { dataStore } from '../services/dataStore';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: User) => void;
  currentUser?: User;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
}) => {
  const users = dataStore.getUsers();
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser?.role || 'admin');
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.id || users[0]?.id || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'credentials'>('quick');

  if (!isOpen) return null;

  const handleQuickLogin = (user: User) => {
    setIsLoading(true);
    setTimeout(() => {
      dataStore.setCurrentUser(user);
      if (onLoginSuccess) onLoginSuccess(user);
      setIsLoading(false);
      onClose();
    }, 400);
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      // Find matching user or fallback to first admin
      const matched = users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || users[0];
      dataStore.setCurrentUser(matched);
      if (onLoginSuccess) onLoginSuccess(matched);
      setIsLoading(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10 cursor-pointer"
          title="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header with Prominent Official Bhawani Logo */}
        <div className="pt-8 pb-6 px-6 text-center bg-gradient-to-b from-blue-50/50 via-white to-white border-b border-slate-100">
          <BhawaniLogo variant="stacked" size="lg" className="mx-auto" />
          
          <div className="mt-4">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Mobilisation Management System
            </h2>
            <p className="text-xs text-blue-600 font-semibold mt-0.5">
              Bhawani Marketing Pvt Ltd
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
              Field Operations, Candidate Tracking &amp; Scheme Verification Portal
            </p>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl mt-5 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('quick')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'quick' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Role Access
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('credentials')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'credentials' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Account Login
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {activeTab === 'quick' ? (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Select Active Profile
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {users.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleQuickLogin(u)}
                      disabled={isLoading}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            u.role === 'admin'
                              ? 'bg-blue-600 text-white'
                              : u.role === 'manager'
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {u.role === 'mobiliser' && u.state ? u.state.charAt(0) : u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {u.role === 'mobiliser'
                              ? (u.state ? `Mobiliser (${u.state})` : 'Mobiliser')
                              : u.name}
                          </div>
                          <div className="text-[10px] text-slate-500 capitalize">
                            {u.role === 'mobiliser' ? 'Mobiliser' : `${u.role} • ${u.district}`}
                          </div>
                        </div>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          Active
                        </span>
                      ) : (
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@bhawanimarketing.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
              >
                {isLoading ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <span>Sign In to System</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer Branding Note */}
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>© {new Date().getFullYear()} Bhawani Marketing Pvt Ltd</span>
            <span className="font-semibold text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" /> Authorized Portal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
