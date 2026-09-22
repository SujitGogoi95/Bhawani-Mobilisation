import React from 'react';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  MapPin,
  CalendarRange,
  PhoneCall,
  CalendarClock,
  BarChart3,
  Award,
  FileSpreadsheet,
  FileText,
  Settings,
  UserCheck,
  Briefcase,
  X,
} from 'lucide-react';
import { User, UserRole } from '../types';
import { BhawaniLogo } from './BhawaniLogo';

interface SidebarProps {
  activeTab: string;
  onTabChange?: (tab: string) => void;
  onSelectTab?: (tab: string) => void;
  userRole?: UserRole;
  currentUser?: User;
  pendingFollowUpsCount?: number;
  className?: string;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onSelectTab,
  userRole,
  currentUser,
  pendingFollowUpsCount = 0,
  className,
  onClose,
}) => {
  const currentRole = userRole || currentUser?.role || 'admin';
  const handleTabClick = (tabId: string) => {
    if (onSelectTab) onSelectTab(tabId);
    if (onTabChange) onTabChange(tabId);
    if (onClose) onClose();
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'mobiliser'] },
    { id: 'candidates', label: 'Students', icon: Users, roles: ['admin', 'manager', 'mobiliser'] },
    { id: 'mobilisation-plan', label: 'Mobilisation Plan', icon: CalendarRange, roles: ['admin', 'manager', 'mobiliser'] },
    { id: 'activities', label: 'Field Activities', icon: MapPin, roles: ['admin', 'manager', 'mobiliser'] },
    { id: 'telecalling', label: 'Tele-calling', icon: PhoneCall, roles: ['admin', 'manager', 'mobiliser'] },
    {
      id: 'followups',
      label: 'Follow-ups',
      icon: CalendarClock,
      badge: pendingFollowUpsCount > 0 ? pendingFollowUpsCount : undefined,
      roles: ['admin', 'manager', 'mobiliser'],
    },
    { id: 'districts', label: 'Performance', icon: BarChart3, roles: ['admin', 'manager'] },
    { id: 'mobilisers', label: 'Mobiliser Leaderboard', icon: Award, roles: ['admin', 'manager'] },
    { id: 'documents', label: 'Documents', icon: FileText, roles: ['admin', 'manager', 'mobiliser'] },
    { id: 'mobiliser-management', label: 'Mobiliser Master', icon: UserCheck, roles: ['admin'] },
    { id: 'programme-management', label: 'Programme Master', icon: Briefcase, roles: ['admin'] },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet, roles: ['admin', 'manager'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin', 'manager'] },
  ];

  const visibleItems = menuItems.filter((item) => item.roles.includes(currentRole));

  return (
    <aside className={`w-64 bg-[#111827] flex flex-col h-full shrink-0 border-r border-gray-800 select-none ${className || 'hidden lg:flex'}`}>
      {/* Brand Header: Bhawani Marketing Pvt Ltd & MMS */}
      <div className="p-4 sm:p-5 border-b border-gray-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shrink-0 shadow-sm border border-slate-700/50">
            <BhawaniLogo variant="mark" size="sm" />
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-bold text-xs tracking-tight leading-tight truncate">
              Mobilisation Management System
            </h1>
            <span className="text-[10px] text-blue-400 font-semibold tracking-wide block truncate mt-0.5">
              Bhawani Marketing Pvt Ltd
            </span>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 shrink-0 cursor-pointer lg:hidden"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeTab === item.id ||
            (item.id === 'telecalling' && activeTab === 'tele-calling') ||
            (item.id === 'followups' && activeTab === 'follow-ups') ||
            (item.id === 'districts' && activeTab === 'district-performance') ||
            (item.id === 'mobilisers' && activeTab === 'mobiliser-performance');

          return (
            <button
              key={item.id}
              id={`sidebar-tab-${item.id}`}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && item.badge > 0 && (
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-white text-blue-700' : 'bg-rose-500 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Profile Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {currentUser?.role === 'mobiliser'
              ? (currentUser.state ? currentUser.state.charAt(0) : 'M')
              : (currentUser?.name ? currentUser.name.charAt(0) : 'A')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-gray-300 font-medium truncate">
              {currentUser?.role === 'mobiliser'
                ? (currentUser.state ? `Mobiliser (${currentUser.state})` : 'Mobiliser')
                : (currentUser?.name || 'Admin User')}
            </div>
            <div className="text-[11px] text-gray-500 capitalize truncate">
              {currentUser?.role === 'mobiliser'
                ? 'Mobiliser'
                : `${currentUser?.role || 'Administrator'} • ${currentUser?.district || 'HQ'}`}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
