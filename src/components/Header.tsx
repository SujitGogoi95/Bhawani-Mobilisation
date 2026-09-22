import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  Bell,
  Smartphone,
  Monitor,
  UserCheck,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  X,
  Plus,
  LogIn,
  Menu,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { User as UserType, SystemNotification } from '../types';
import { BhawaniLogo } from './BhawaniLogo';

interface HeaderProps {
  currentUser: UserType;
  onSelectUser?: (userId: string) => void;
  onUserChange?: (user: UserType) => void;
  onOpenSearch?: () => void;
  onOpenAddCandidate?: () => void;
  onOpenLogin?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileFrame?: boolean;
  onToggleMobileFrame?: () => void;
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onSelectUser,
  onUserChange,
  onOpenSearch,
  onOpenAddCandidate,
  onOpenLogin,
  onToggleMobileMenu,
  isMobileFrame = false,
  onToggleMobileFrame,
  activeTab = 'dashboard',
  onNavigate,
}) => {
  const [isOnline, setIsOnline] = useState(dataStore.getIsOnline());
  const [offlineQueue, setOfflineQueue] = useState(dataStore.getOfflineQueue());
  const [notifications, setNotifications] = useState<SystemNotification[]>(dataStore.getNotifications());
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const users = dataStore.getUsers();

  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setIsOnline(dataStore.getIsOnline());
      setOfflineQueue(dataStore.getOfflineQueue());
      setNotifications(dataStore.getNotifications());
    });
    return unsubscribe;
  }, []);

  const handleToggleOnline = () => {
    const newStatus = !isOnline;
    dataStore.setOnlineStatus(newStatus);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    dataStore.syncPendingRecords();
    try {
      await dataStore.syncCandidatesFromGoogleSheets();
    } catch {
      // Handled gracefully in dataStore
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectUser = (user: UserType) => {
    if (onSelectUser) onSelectUser(user.id);
    if (onUserChange) onUserChange(user);
    setShowUserMenu(false);
  };

  const getActiveTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Management Dashboard';
      case 'candidates': return 'Student Directory';
      case 'activities': return 'Field Activities';
      case 'telecalling':
      case 'tele-calling': return 'Tele-calling Queue';
      case 'followups':
      case 'follow-ups': return 'Follow-up Schedule';
      case 'districts':
      case 'district-performance': return 'District Performance';
      case 'mobilisers':
      case 'mobiliser-performance': return 'Mobiliser Leaderboard';
      case 'documents': return 'Document Verification Desk';
      case 'mobiliser-management': return 'Mobiliser Master';
      case 'programme-management': return 'Programme Master';
      case 'reports': return 'Operational Reports & Export';
      case 'settings': return 'System Configuration & Masters';
      default: return 'Overview';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-3 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 sticky top-0 z-30">
      {/* Top-Left: Bhawani Marketing Pvt Ltd Official Logo & App Branding */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0">
        {/* Mobile Hamburger Drawer Trigger */}
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 -ml-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0 py-1">
          {/* Official Logo */}
          <BhawaniLogo variant="horizontal" size="sm" />

          {/* Application Branding & Subtitle (Tablet/Desktop) */}
          <div className="hidden md:block border-l border-gray-200 pl-2.5">
            <div className="text-xs font-bold text-slate-900 tracking-tight leading-none truncate">
              Mobilisation Management System
            </div>
            <div className="text-[10px] font-semibold text-blue-600 leading-tight tracking-wide mt-0.5 truncate">
              Bhawani Marketing Pvt Ltd
            </div>
          </div>
        </div>

        {/* Breadcrumb Navigation (Large screens only) */}
        <div className="hidden xl:flex items-center text-xs text-gray-400 pl-2.5 border-l border-gray-200">
          <span className="text-gray-400">Overview</span>
          <span className="mx-1.5 text-gray-300">/</span>
          <span className="font-semibold text-slate-800 truncate">
            {getActiveTabTitle()}
          </span>
        </div>
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center space-x-1.5 sm:space-x-2.5">
        {/* Search Input Pill */}
        <button
          id="header-search-btn"
          onClick={onOpenSearch}
          className="relative h-9 w-9 sm:w-44 md:w-56 lg:w-64 bg-gray-100 hover:bg-gray-200/70 rounded-full flex items-center justify-center sm:justify-start px-2.5 sm:px-3.5 text-xs text-gray-500 transition-colors cursor-pointer"
          title="Search candidates, phone, village (Press /)"
        >
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="hidden sm:inline text-gray-400 font-medium truncate ml-2">Search...</span>
          <kbd className="hidden lg:inline-block ml-auto px-1.5 py-0.2 text-[10px] font-mono bg-white border border-gray-200 rounded text-gray-400">
            /
          </kbd>
        </button>

        {/* Quick Add Student Button (Desktop/Tablet) */}
        {onOpenAddCandidate && (
          <button
            id="header-add-student-btn"
            onClick={onOpenAddCandidate}
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>
        )}

        {/* Online / Offline Toggle Pill */}
        {isOnline ? (
          <>
            <button
              id="header-toggle-offline-btn"
              onClick={handleToggleOnline}
              title="Click to simulate field offline mode"
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-slate-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[11px] font-semibold text-slate-700">Online</span>
            </button>
            <button
              id="header-toggle-offline-mobile"
              onClick={handleToggleOnline}
              title="Online (Field Sync Active). Tap to simulate offline."
              className="sm:hidden w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center cursor-pointer text-slate-700 hover:bg-gray-200"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            </button>
          </>
        ) : (
          <div className="flex items-center space-x-1">
            <button
              id="header-toggle-online-btn"
              onClick={handleToggleOnline}
              title="Click to reconnect online"
              className="flex items-center space-x-1 px-2 sm:px-2.5 py-1 rounded-full text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 transition-colors cursor-pointer"
            >
              <WifiOff className="w-3 h-3 text-amber-600 animate-pulse" />
              <span className="text-[10px] sm:text-[11px]">Offline</span>
            </button>
            {offlineQueue.length > 0 && (
              <button
                id="header-sync-now-btn"
                onClick={handleSyncNow}
                disabled={syncing}
                className="flex items-center space-x-1 px-2 py-1 rounded-full text-[10px] sm:text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
                title="Sync queued changes"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                <span>{offlineQueue.length}</span>
              </button>
            )}
          </div>
        )}

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            id="header-notifications-btn"
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 hover:bg-gray-200 transition-colors relative cursor-pointer text-slate-700"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <div className="w-2 h-2 bg-red-500 rounded-full absolute top-1 right-1"></div>
            )}
          </button>

          {/* Notifications Dropdown (Responsive Width) */}
          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-sm sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">Notifications &amp; Alerts</span>
                </div>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400">
                    No active notifications
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs flex items-start space-x-2.5 hover:bg-gray-50 transition-colors ${
                        !n.read ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                        {n.type === 'info' && <Clock className="w-4 h-4 text-blue-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 leading-snug">{n.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                        <span className="text-[10px] text-gray-400 block mt-1">{n.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-gray-100 text-center">
                <button
                  onClick={() => setShowNotifMenu(false)}
                  className="text-[11px] text-gray-500 hover:text-slate-800 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Role Switcher */}
        <div className="relative pl-1 sm:pl-2 border-l border-gray-200">
          <button
            id="header-user-switcher-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-1.5 py-1 px-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#111827] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {currentUser.role === 'mobiliser'
                ? (currentUser.state ? currentUser.state.charAt(0) : 'M')
                : currentUser.name.charAt(0)}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[170px]">
                {currentUser.role === 'mobiliser'
                  ? (currentUser.state ? `Mobiliser (${currentUser.state})` : 'Mobiliser')
                  : currentUser.name}
              </div>
              <div className="text-[10px] text-gray-500 capitalize leading-tight">
                {currentUser.role === 'mobiliser' ? 'Mobiliser' : currentUser.role}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
          </button>

          {/* User Selector Dropdown (Responsive Width) */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-xs sm:w-72 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in">
              <div className="px-3.5 py-2 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Switch Active Role
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Seamlessly test Admin, Manager, or Field Mobiliser scopes
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {users.map((u) => {
                  const isSelected = u.id === currentUser.id;
                  const displayName =
                    u.role === 'mobiliser'
                      ? (u.state ? `Mobiliser (${u.state})` : 'Mobiliser')
                      : u.name;
                  const subtitle =
                    u.role === 'mobiliser'
                      ? 'Mobiliser'
                      : `${u.district} • ${u.role}`;

                  return (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs hover:bg-gray-50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50 font-semibold text-blue-900' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            u.role === 'admin'
                              ? 'bg-blue-100 text-blue-700'
                              : u.role === 'manager'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {u.role === 'mobiliser' && u.state ? u.state.charAt(0) : u.name.charAt(0)}
                        </div>
                        <div className="truncate">
                          <p className="truncate font-medium">{displayName}</p>
                          <p className="text-[10px] text-gray-400 truncate capitalize font-normal">
                            {subtitle}
                          </p>
                        </div>
                      </div>
                      {isSelected && <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {onOpenLogin && (
                <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenLogin();
                    }}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Open Login &amp; Auth Screen</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

