import React, { useState, useEffect } from 'react';
import { dataStore } from './services/dataStore';
import { User, Candidate } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './components/DashboardView';
import { CandidatesView } from './components/CandidatesView';
import { CandidateProfileModal } from './components/CandidateProfileModal';
import { AddCandidateModal } from './components/AddCandidateModal';
import { TelecallingView } from './components/TelecallingView';
import { MobilisationPlanView } from './components/MobilisationPlanView';
import { FieldActivitiesView } from './components/FieldActivitiesView';
import { FollowUpsView } from './components/FollowUpsView';
import { DistrictPerformanceView } from './components/DistrictPerformanceView';
import { MobiliserPerformanceView } from './components/MobiliserPerformanceView';
import { DocumentsView } from './components/DocumentsView';
import { ReportsView } from './components/ReportsView';
import { MobiliserManagementView } from './components/MobiliserManagementView';
import { ProgrammeManagementView } from './components/ProgrammeManagementView';
import { SettingsView } from './components/SettingsView';
import { LoginModal } from './components/LoginModal';
import { Plus } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<User>(dataStore.getCurrentUser());
  const [isOnline, setIsOnline] = useState<boolean>(dataStore.getOnlineStatus());
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [telecallingCandidateId, setTelecallingCandidateId] = useState<string | undefined>(undefined);
  const [followUpCandidateId, setFollowUpCandidateId] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Subscribe to DataStore updates
  useEffect(() => {
    const unsubscribe = dataStore.subscribe(() => {
      setCurrentUser(dataStore.getCurrentUser());
      setIsOnline(dataStore.getOnlineStatus());
    });
    return unsubscribe;
  }, []);

  const handleUserChange = (user: User) => {
    dataStore.setCurrentUser(user);
    setCurrentUser(user);
    showBannerNotification(`Switched role to ${user.name} (${user.role.toUpperCase()})`);
  };

  const showBannerNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleCandidateAdded = (newCandidate: Candidate) => {
    setShowAddModal(false);
    showBannerNotification(`Candidate ${newCandidate.name} (${newCandidate.candidateId}) registered successfully!`);
    setActiveTab('candidates');
    setSelectedCandidateId(undefined);
  };

  const handleStartCall = (candidateId: string) => {
    setTelecallingCandidateId(candidateId);
    setActiveTab('telecalling');
  };

  const handleScheduleFollowUp = (candidateId: string) => {
    setFollowUpCandidateId(candidateId);
    setActiveTab('followups');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased text-slate-900">
      {/* Global Top Banner Notification */}
      {notification && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-70 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Global Header */}
      <Header
        currentUser={currentUser}
        onUserChange={handleUserChange}
        onOpenAddCandidate={() => setShowAddModal(true)}
        onOpenLogin={() => setShowLoginModal(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-2 sm:px-4 lg:px-6 py-4 gap-6">
        {/* Desktop Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setTelecallingCandidateId(undefined);
            setFollowUpCandidateId(undefined);
          }}
          currentUser={currentUser}
        />

        {/* Dynamic Views Viewport */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectCandidate={(id) => setSelectedCandidateId(id)}
              onOpenAddCandidate={() => setShowAddModal(true)}
            />
          )}

          {activeTab === 'candidates' && (
            <CandidatesView
              currentUser={currentUser}
              onSelectCandidate={(id) => setSelectedCandidateId(id)}
              onOpenAddCandidate={() => setShowAddModal(true)}
              onOpenAddStudent={() => setShowAddModal(true)}
            />
          )}

          {activeTab === 'telecalling' && (
            <TelecallingView
              currentUser={currentUser}
              onSelectCandidate={(id) => setSelectedCandidateId(id)}
              presetCandidateId={telecallingCandidateId}
            />
          )}

          {activeTab === 'mobilisation-plan' && (
            <MobilisationPlanView
              currentUser={currentUser}
              onNavigateToActivities={() => setActiveTab('activities')}
            />
          )}

          {activeTab === 'activities' && (
            <FieldActivitiesView currentUser={currentUser} />
          )}

          {activeTab === 'followups' && (
            <FollowUpsView
              currentUser={currentUser}
              onSelectCandidate={(id) => setSelectedCandidateId(id)}
              presetCandidateId={followUpCandidateId}
            />
          )}

          {activeTab === 'districts' && <DistrictPerformanceView />}

          {activeTab === 'mobilisers' && (
            <MobiliserPerformanceView
              onSelectCandidate={(id) => setSelectedCandidateId(id)}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsView
              currentUser={currentUser}
              onSelectCandidate={(id) => setSelectedCandidateId(id)}
            />
          )}

          {activeTab === 'mobiliser-management' && (
            <MobiliserManagementView currentUser={currentUser} />
          )}

          {activeTab === 'programme-management' && (
            <ProgrammeManagementView currentUser={currentUser} />
          )}

          {activeTab === 'reports' && <ReportsView />}

          {activeTab === 'settings' && <SettingsView currentUser={currentUser} />}
        </main>
      </div>

      {/* Mobile Floating Action Button (Quick Add Student) */}
      <div className="lg:hidden fixed bottom-18 right-4 z-40">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-13 h-13 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-transform"
          aria-label="Register Candidate"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setTelecallingCandidateId(undefined);
          setFollowUpCandidateId(undefined);
        }}
        onOpenAddCandidate={() => setShowAddModal(true)}
        currentUser={currentUser}
      />

      {/* Candidate Profile Details Modal */}
      {selectedCandidateId && (
        <CandidateProfileModal
          candidateId={selectedCandidateId}
          currentUser={currentUser}
          onClose={() => setSelectedCandidateId(null)}
          onStartCall={handleStartCall}
          onScheduleFollowUp={handleScheduleFollowUp}
        />
      )}

      {/* Add Candidate Form Wizard Modal */}
      {showAddModal && (
        <AddCandidateModal
          currentUser={currentUser}
          onClose={() => setShowAddModal(false)}
          onCandidateAdded={handleCandidateAdded}
          onOpenExistingCandidate={(id) => {
            setShowAddModal(false);
            setSelectedCandidateId(id);
          }}
        />
      )}

      {/* Official Bhawani Marketing Pvt Ltd Login & Authentication Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          currentUser={currentUser}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={(u) => handleUserChange(u)}
        />
      )}
    </div>
  );
}
