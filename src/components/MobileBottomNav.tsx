import React, { useState } from 'react';
import {
  Home,
  Users,
  PlusCircle,
  PhoneCall,
  Menu,
  X,
  MapPin,
  CalendarRange,
  CalendarClock,
  BarChart3,
  Award,
  FileSpreadsheet,
  FileText,
  Settings,
  Wifi,
  WifiOff,
  Plus,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { dataStore } from '../services/dataStore';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange?: (tab: string) => void;
  onSelectTab?: (tab: string) => void;
  userRole?: UserRole;
  currentUser?: User;
  onOpenAddCandidate?: () => void;
  pendingFollowUpsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onSelectTab,
  userRole,
  currentUser,
  onOpenAddCandidate,
  pendingFollowUpsCount = 0,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const isOnline = dataStore.getIsOnline();
  const queueCount = dataStore.getOfflineQueue().length;
  const currentRole = userRole || currentUser?.role || 'admin';

  const handleSelectTab = (tab: string) => {
    if (onSelectTab) onSelectTab(tab);
    if (onTabChange) onTabChange(tab);
    setShowMoreMenu(false);
  };

  const moreItems = [
    { id: 'mobilisation-plan', label: 'Mobilisation Plan', icon: CalendarRange, roles: ['admin', 'manager', 'mobiliser'] },
    { id: 'activities', label: 'Field Activities', icon: MapPin, roles: ['admin', 'manager', 'mobiliser'] },
    {
      id: 'followups',
      label: 'Follow-ups',
      icon: CalendarClock,
      badge: pendingFollowUpsCount,
      roles: ['admin', 'manager', 'mobiliser'],
    },
    { id: 'documents', label: 'Documents', icon: FileText, roles: ['admin', 'manager', 'mobiliser'] },
    { id: 'districts', label: 'Performance', icon: BarChart3, roles: ['admin', 'manager'] },
    { id: 'mobilisers', label: 'Mobiliser Leaderboard', icon: Award, roles: ['admin', 'manager'] },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet, roles: ['admin', 'manager'] },
    { id: 'settings', label: 'System Configuration', icon: Settings, roles: ['admin', 'manager'] },
  ].filter((item) => item.roles.includes(currentRole));

  return (
    <>
      {/* "More" Drawer for mobile */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#111827]/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-gray-100 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">All Operations</h3>
                <p className="text-xs text-gray-500">Quick access to field workflows</p>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Offline status info inside drawer */}
            <div className="p-3 mb-3 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                {isOnline ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                ) : (
                  <WifiOff className="w-4 h-4 text-amber-600 animate-pulse" />
                )}
                <div>
                  <p className="font-semibold text-slate-800">
                    {isOnline ? 'Online Sync Active' : 'Offline Mode Active'}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {queueCount > 0 ? `${queueCount} operations queued` : 'All records synchronized'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => dataStore.setOnlineStatus(!isOnline)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-slate-700 shadow-2xs"
              >
                Toggle {isOnline ? 'Offline' : 'Online'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id || (item.id === 'followups' && activeTab === 'follow-ups');
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl text-left border transition-all ${
                      isActive
                        ? 'bg-blue-50 border-blue-200 text-blue-900 font-semibold'
                        : 'bg-white border-gray-200 text-slate-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{item.label}</div>
                      {item.badge && item.badge > 0 && (
                        <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-red-500 text-white">
                          {item.badge} pending
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 px-2 sm:px-4 py-1.5 flex items-center justify-around z-40 select-none shadow-lg">
        {/* Home */}
        <button
          onClick={() => handleSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center w-14 py-0.5 rounded-lg text-center cursor-pointer transition-colors ${
            activeTab === 'dashboard' ? 'text-blue-600 font-semibold' : 'text-gray-400 hover:text-slate-800'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Home</span>
        </button>

        {/* Students */}
        <button
          onClick={() => handleSelectTab('candidates')}
          className={`flex flex-col items-center justify-center w-14 py-0.5 rounded-lg text-center cursor-pointer transition-colors ${
            activeTab === 'candidates' ? 'text-blue-600 font-semibold' : 'text-gray-400 hover:text-slate-800'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Students</span>
        </button>

        {/* ADD STUDENT - Clean Minimalist Center Action */}
        <button
          onClick={() => {
            if (onOpenAddCandidate) {
              onOpenAddCandidate();
            } else {
              handleSelectTab('candidates');
            }
          }}
          className="flex flex-col items-center justify-center -mt-5 cursor-pointer group"
          title="Add New Student"
        >
          <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30 group-active:scale-95 transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold text-blue-600 mt-0.5">Add</span>
        </button>

        {/* Tele-calling */}
        <button
          onClick={() => handleSelectTab('telecalling')}
          className={`flex flex-col items-center justify-center w-14 py-0.5 rounded-lg text-center cursor-pointer transition-colors ${
            activeTab === 'telecalling' || activeTab === 'tele-calling'
              ? 'text-blue-600 font-semibold'
              : 'text-gray-400 hover:text-slate-800'
          }`}
        >
          <PhoneCall className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">Calls</span>
        </button>

        {/* More */}
        <button
          onClick={() => setShowMoreMenu(true)}
          className={`relative flex flex-col items-center justify-center w-14 py-0.5 rounded-lg text-center cursor-pointer transition-colors ${
            showMoreMenu || ['activities', 'followups', 'follow-ups', 'reports', 'documents', 'settings', 'districts', 'mobilisers'].includes(activeTab)
              ? 'text-blue-600 font-semibold'
              : 'text-gray-400 hover:text-slate-800'
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] leading-tight">More</span>
          {pendingFollowUpsCount > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          )}
        </button>
      </div>
    </>
  );
};
