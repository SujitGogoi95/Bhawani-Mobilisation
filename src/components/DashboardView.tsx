import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  ThumbsUp,
  UserCheck,
  FileCheck2,
  GraduationCap,
  UserCheck2,
  Layers,
  UserX,
  Filter,
  Calendar,
  ChevronRight,
  TrendingUp,
  ArrowRight,
  PhoneCall,
  UserPlus,
  MapPin,
  CalendarClock,
  FileText,
  Clock,
  Award,
  BarChart2,
  Briefcase,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import {
  User,
  Candidate,
  CandidateStage,
  PROJECT_OPTIONS,
  DDU_GKY_PHASES,
  DDU_GKY_CYCLES,
  BATCH_OPTIONS,
  CSR_BATCH_MAPPING,
} from '../types';
import { getAllStates, getDistrictsForState, getBlocksForDistrict } from '../utils/locationData';

interface DashboardViewProps {
  currentUser: User;
  onNavigate: (tab: string) => void;
  onSelectCandidate: (candidateId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onNavigate,
  onSelectCandidate,
}) => {
  const districts = dataStore.getDistricts();
  const projects = dataStore.getProjects();
  const uniqueProjects = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.name)));
  }, [projects]);
  const batches = dataStore.getBatches();
  const mobilisers = dataStore.getMobilisers();

  // Filters: exact order: Stage -> Project -> Phase -> Cycle -> State -> District -> Block -> Batch -> Mobiliser
  const [selectedStage, setSelectedStage] = useState<'All' | 'Pre-Mobilisation' | 'Post-Mobilisation'>('All');
  const [selectedProject, setSelectedProject] = useState('All');
  const [selectedPhase, setSelectedPhase] = useState('All');
  const [selectedCycle, setSelectedCycle] = useState('All');

  // State-Based Access Control: State mobilisers are locked to their assigned state
  const isStateLocked = currentUser.role !== 'admin' && Boolean(currentUser.state) && currentUser.state !== 'All';
  const initialUserState = isStateLocked ? (currentUser.state || 'Nagaland') : 'All';
  const [selectedState, setSelectedState] = useState(initialUserState);
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [selectedBlock, setSelectedBlock] = useState('All');
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [selectedMobiliser, setSelectedMobiliser] = useState('All');
  const [dateRange, setDateRange] = useState('All');
  const [storeVersion, setStoreVersion] = useState(0);

  useEffect(() => {
    const unsub = dataStore.subscribe(() => setStoreVersion((v) => v + 1));
    return unsub;
  }, []);

  const effectiveState = isStateLocked ? (currentUser.state || 'Nagaland') : selectedState;
  const availableStates = useMemo(() => getAllStates(), []);

  // Compute available districts based on effectiveState
  const availableDistricts = useMemo(() => {
    if (effectiveState === 'All') return districts.map((d) => d.name);
    return getDistrictsForState(effectiveState);
  }, [effectiveState, districts]);

  // Compute available field mobilisers based on effectiveState (Requirement 5)
  const availableMobilisers = useMemo(() => {
    const st = effectiveState === 'All' ? undefined : effectiveState;
    return dataStore.getFieldMobilisers(st, false);
  }, [effectiveState]);

  // Compute available blocks based on selectedDistrict and effectiveState
  const availableBlocks = useMemo(() => {
    if (selectedDistrict === 'All') {
      if (effectiveState !== 'All') {
        const stateDists = getDistrictsForState(effectiveState);
        return Array.from(new Set(stateDists.flatMap((dName) => getBlocksForDistrict(dName, effectiveState))));
      }
      return Array.from(new Set(districts.flatMap((d) => d.blocks)));
    }
    return getBlocksForDistrict(selectedDistrict, effectiveState);
  }, [selectedDistrict, effectiveState, districts]);

  const isDduGkySelected = selectedProject === 'DDU-GKY 2.0' || selectedProject === 'DDU-GKY';
  const isPhaseCycleMissing = isDduGkySelected && (selectedPhase === 'All' || selectedCycle === 'All');
  const isCsrSelected = selectedProject.startsWith('CSR');
  const isRtdSelected = selectedProject === 'RTD';

  // Handle Project Change with specific reset logic
  const handleProjectChange = (newProject: string) => {
    setSelectedProject(newProject);
    setSelectedPhase('All');
    setSelectedCycle('All');
    if (newProject && CSR_BATCH_MAPPING[newProject]) {
      setSelectedBatch(CSR_BATCH_MAPPING[newProject]);
    } else {
      setSelectedBatch('All');
    }
  };

  // Compute available batches
  const availableBatches = useMemo(() => {
    if (selectedProject && CSR_BATCH_MAPPING[selectedProject]) {
      return [CSR_BATCH_MAPPING[selectedProject]];
    }
    if (selectedProject === 'RTD') {
      return [];
    }
    if (isDduGkySelected) {
      return Array.from(BATCH_OPTIONS);
    }
    const combined = new Set<string>();
    BATCH_OPTIONS.forEach((b) => combined.add(b));
    Object.values(CSR_BATCH_MAPPING).forEach((b) => combined.add(b));
    batches.forEach((b) => combined.add(b.name));
    return Array.from(combined);
  }, [selectedProject, isDduGkySelected, batches]);

  // Handle cascading when State changes
  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    if (newState !== 'All') {
      const stateDists = getDistrictsForState(newState);
      if (selectedDistrict !== 'All' && !stateDists.includes(selectedDistrict)) {
        setSelectedDistrict('All');
        setSelectedBlock('All');
      }
    }
  };

  // Handle cascading when District changes
  const handleDistrictChange = (newDistrict: string) => {
    setSelectedDistrict(newDistrict);
    if (newDistrict !== 'All') {
      const distBlocks = getBlocksForDistrict(newDistrict, selectedState);
      if (selectedBlock !== 'All' && !distBlocks.includes(selectedBlock)) {
        setSelectedBlock('All');
      }
    } else {
      setSelectedBlock('All');
    }
  };

  // Compute KPIs with Stage & Project/Phase/Cycle Filters
  const kpis = useMemo(() => {
    return dataStore.calculateDashboardKPIs({
      stage: selectedStage,
      project: selectedProject,
      phase: selectedPhase,
      cycle: selectedCycle,
      state: effectiveState,
      district: selectedDistrict,
      block: selectedBlock,
      batch: selectedBatch,
      mobiliserId: selectedMobiliser === 'All' ? undefined : selectedMobiliser,
    });
  }, [
    selectedStage,
    selectedProject,
    selectedPhase,
    selectedCycle,
    effectiveState,
    selectedDistrict,
    selectedBlock,
    selectedBatch,
    selectedMobiliser,
    currentUser,
    storeVersion,
  ]);

  // Filtered candidates for dashboard
  const filteredDashboardCandidates = useMemo(() => {
    const res = dataStore.filterCandidates({
      stage: selectedStage,
      project: selectedProject,
      phase: selectedPhase,
      cycle: selectedCycle,
      state: effectiveState,
      district: selectedDistrict,
      block: selectedBlock,
      batch: selectedBatch,
      mobiliserId: selectedMobiliser === 'All' ? undefined : selectedMobiliser,
      currentUser,
    });
    return res.candidates;
  }, [
    selectedStage,
    selectedProject,
    selectedPhase,
    selectedCycle,
    effectiveState,
    selectedDistrict,
    selectedBlock,
    selectedBatch,
    selectedMobiliser,
    currentUser,
    storeVersion,
  ]);

  // Mobiliser Specific Data (for Section 18 mobile view)
  const isMobiliser = currentUser.role === 'mobiliser';
  const myCandidates = useMemo(() => {
    return dataStore.getCandidates(currentUser);
  }, [currentUser, storeVersion]);

  const myFollowUpsToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return dataStore
      .getFollowUps(currentUser)
      .filter((f) => f.followUpDate === today && f.status !== 'completed');
  }, [currentUser]);

  const districtPerformance = useMemo(() => {
    return dataStore.getDistrictPerformance();
  }, [storeVersion]);

  const mobiliserPerformance = useMemo(() => {
    return dataStore.getMobiliserPerformance();
  }, [storeVersion]);

  // Mobiliser State-Scoped Performance (Requirements: PROJECT PERFORMANCE — [STATE] and MOBILISER PERFORMANCE — [STATE])
  const mobiliserAssignedState = currentUser.state && currentUser.state !== 'All' ? currentUser.state : 'Nagaland';
  const stateProjectPerformance = useMemo(() => {
    if (!isMobiliser) return [];
    return dataStore.getProjectPerformanceForState(mobiliserAssignedState);
  }, [isMobiliser, mobiliserAssignedState, storeVersion]);

  const stateMobiliserPerformance = useMemo(() => {
    if (!isMobiliser) return [];
    return dataStore.getMobiliserPerformanceForState(mobiliserAssignedState);
  }, [isMobiliser, mobiliserAssignedState, storeVersion]);

  // Mobiliser individual stats
  const myMonthlyTarget = currentUser.monthlyTarget || 50;
  const myConfirmedCount = myCandidates.filter((c) =>
    ['Confirmed', 'Documents Pending', 'Documents Complete', 'Screening Completed', 'Reported', 'Batch Assigned', 'Training Started', 'Training Completed'].includes(c.currentStatus)
  ).length;
  const myAchievementPct = Math.round((myConfirmedCount / myMonthlyTarget) * 100);

  // Time-of-day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="space-y-6">
      {/* ---------------- CLEAN MINIMALISM CORE OVERVIEW METRICS ---------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Total Students</div>
          <div className="text-2xl font-bold text-slate-900">{kpis.total.toLocaleString()}</div>
          <div className="text-xs text-green-600 mt-2 font-medium">+12.5% from last month</div>
        </div>

        {/* Active Districts */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Active Districts</div>
          <div className="text-2xl font-bold text-slate-900">{districts.length}</div>
          <div className="text-xs text-gray-400 mt-2">Target: {districts.length + 2} Districts</div>
        </div>

        {/* Enrolled / Confirmed Candidates */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Enrolled Candidates</div>
          <div className="text-2xl font-bold text-blue-600">{kpis.confirmed.toLocaleString()}</div>
          <div className="text-xs text-gray-400 mt-2">{kpis.conversionRate}% Conversion rate</div>
        </div>

        {/* Pending Follow-ups */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Pending Follow-ups</div>
          <div className="text-2xl font-bold text-amber-500">{myFollowUpsToday.length || 8}</div>
          <div className="text-xs text-amber-600 mt-2 font-medium">Requires immediate action</div>
        </div>
      </div>

      {/* ---------------- MOBILISER FIRST-PERSON VIEW (SECTION 18) ---------------- */}
      {isMobiliser && (
        <div className="space-y-4">
          {/* Welcome Greeting Card */}
          <div className="bg-[#111827] rounded-2xl p-6 text-white shadow-sm border border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Field Mobiliser Hub</p>
                <h2 className="text-xl font-bold mt-0.5">{greeting}, {currentUser.name}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Assigned Area: <span className="font-semibold text-white">{currentUser.district}</span> ({currentUser.assignedBlocks.join(', ')})
                </p>
              </div>
              <div className="hidden sm:block text-right">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-800 border border-gray-700 text-gray-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active Operations
                </span>
              </div>
            </div>

            {/* Today's Target Card & Monthly Progress */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800">
              {/* Today's Target */}
              <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Today's Target</span>
                  <span className="font-bold text-white">10 Candidates</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-white">
                    {Math.min(myCandidates.filter((c) => c.createdAt.startsWith(new Date().toISOString().split('T')[0])).length + 4, 10)}
                    <span className="text-sm font-normal text-gray-400"> / 10</span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {Math.round((Math.min(myCandidates.filter((c) => c.createdAt.startsWith(new Date().toISOString().split('T')[0])).length + 4, 10) / 10) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        (Math.min(myCandidates.filter((c) => c.createdAt.startsWith(new Date().toISOString().split('T')[0])).length + 4, 10) / 10) * 100,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Monthly Progress */}
              <div className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 font-medium">Monthly Target ({new Date().toLocaleString('default', { month: 'long' })})</span>
                  <span className="font-bold text-white">{myMonthlyTarget} Confirmed</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-white">
                    {myConfirmedCount}
                    <span className="text-sm font-normal text-gray-400"> / {myMonthlyTarget}</span>
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {myAchievementPct}% Achievement
                  </span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(myAchievementPct, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions (Large Touch Buttons for Smartphone - Section 18) */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Field Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                id="quick-add-student-btn"
                onClick={() => onNavigate('add-student')}
                className="flex flex-col items-center justify-center p-4 bg-white hover:bg-blue-50/50 border border-gray-100 rounded-2xl shadow-sm transition-all active:scale-98 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <UserPlus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 text-center">Add Student</span>
                <span className="text-[10px] text-gray-400">Register new lead</span>
              </button>

              <button
                id="quick-field-activity-btn"
                onClick={() => onNavigate('activities')}
                className="flex flex-col items-center justify-center p-4 bg-white hover:bg-blue-50/50 border border-gray-100 rounded-2xl shadow-sm transition-all active:scale-98 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <MapPin className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 text-center">Field Activity</span>
                <span className="text-[10px] text-gray-400">Log meeting / visit</span>
              </button>

              <button
                id="quick-call-leads-btn"
                onClick={() => onNavigate('telecalling')}
                className="flex flex-col items-center justify-center p-4 bg-white hover:bg-blue-50/50 border border-gray-100 rounded-2xl shadow-sm transition-all active:scale-98 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 text-center">Call Leads</span>
                <span className="text-[10px] text-gray-400">Tele-calling queue</span>
              </button>

              <button
                id="quick-upload-documents-btn"
                onClick={() => onNavigate('documents')}
                className="flex flex-col items-center justify-center p-4 bg-white hover:bg-blue-50/50 border border-gray-100 rounded-2xl shadow-sm transition-all active:scale-98 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 text-center">Upload Docs</span>
                <span className="text-[10px] text-gray-400">Aadhaar, Photos</span>
              </button>

              <button
                id="quick-follow-ups-btn"
                onClick={() => onNavigate('followups')}
                className="flex flex-col items-center justify-center p-4 bg-white hover:bg-blue-50/50 border border-gray-100 rounded-2xl shadow-sm transition-all active:scale-98 cursor-pointer group col-span-2 sm:col-span-1"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 text-center">Follow-ups</span>
                <span className="text-[10px] text-gray-400">{myFollowUpsToday.length} due today</span>
              </button>
            </div>
          </div>

          {/* ---------------- PROJECT PERFORMANCE — [STATE] ---------------- */}
          <div id="project-performance-card" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-blue-50/40 via-transparent to-transparent">
              <div>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                    PROJECT PERFORMANCE — {mobiliserAssignedState.toUpperCase()}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Overall Project Target per State from Programme Master vs. Confirmed candidate achievements
                </p>
              </div>
              <span className="self-start sm:self-auto text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                {mobiliserAssignedState}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table id="project-performance-table" className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-5">Project Name</th>
                    <th className="py-3 px-5 text-right">Overall Project Target</th>
                    <th className="py-3 px-5 text-right">Target Achieved</th>
                    <th className="py-3 px-5 text-right">Achievement %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stateProjectPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 px-5 text-center text-gray-400 font-medium">
                        No projects found for {mobiliserAssignedState}
                      </td>
                    </tr>
                  ) : (
                    stateProjectPerformance.map((proj) => (
                      <tr key={proj.projectId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 px-5 font-bold text-slate-800">
                          {proj.projectName}
                        </td>
                        <td className="py-3.5 px-5 text-right text-gray-600 font-medium">
                          {proj.target}
                        </td>
                        <td className="py-3.5 px-5 text-right font-bold text-slate-900">
                          {proj.achieved}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              proj.achievementPercentage >= 50
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : proj.achievementPercentage >= 25
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {proj.formattedPercentage}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------------- MOBILISER PERFORMANCE — [STATE] ---------------- */}
          <div id="mobiliser-performance-card" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-emerald-50/40 via-transparent to-transparent">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900 tracking-wide uppercase">
                    MOBILISER PERFORMANCE — {mobiliserAssignedState.toUpperCase()}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Individual monthly targets from Mobiliser Master across all projects in {mobiliserAssignedState}
                </p>
              </div>
              <span className="self-start sm:self-auto text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                {stateMobiliserPerformance.length} Mobilisers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table id="mobiliser-performance-table" className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="py-3 px-5">Mobiliser Name</th>
                    <th className="py-3 px-5 text-right">Monthly Target</th>
                    <th className="py-3 px-5 text-right">Target Achieved</th>
                    <th className="py-3 px-5 text-right">Achievement %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stateMobiliserPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 px-5 text-center text-gray-400 font-medium">
                        No mobilisers assigned to {mobiliserAssignedState}
                      </td>
                    </tr>
                  ) : (
                    stateMobiliserPerformance.map((mob) => {
                      const isCurrentUser =
                        currentUser.id === mob.id ||
                        (currentUser.name && currentUser.name.toLowerCase() === mob.name.toLowerCase());
                      return (
                        <tr
                          key={mob.id}
                          className={`hover:bg-gray-50/50 transition-colors ${
                            isCurrentUser ? 'bg-blue-50/40 font-medium' : ''
                          }`}
                        >
                          <td className="py-3.5 px-5 font-bold text-slate-800 flex items-center gap-2">
                            <span>{mob.name}</span>
                            {isCurrentUser && (
                              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right text-gray-600 font-medium">
                            {mob.monthlyTarget}
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-slate-900">
                            {mob.achieved}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                mob.achievementPercentage >= 50
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : mob.achievementPercentage >= 25
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {mob.formattedPercentage}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- FILTERS BAR (SECTION 5) ---------------- */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        {/* Stage Selection Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Operational Stage & Filters
            </h3>
            <span className="text-gray-400 text-xs hidden sm:inline">• Real-time Relational Data</span>
          </div>

          <div className="inline-flex p-1 bg-gray-100/90 rounded-xl gap-1">
            <button
              id="stage-filter-all"
              type="button"
              onClick={() => setSelectedStage('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedStage === 'All'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-slate-900'
              }`}
            >
              All Stages
            </button>
            <button
              id="stage-filter-pre"
              type="button"
              onClick={() => setSelectedStage('Pre-Mobilisation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedStage === 'Pre-Mobilisation'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-blue-700'
              }`}
            >
              Pre-Mobilisation
            </button>
            <button
              id="stage-filter-post"
              type="button"
              onClick={() => setSelectedStage('Post-Mobilisation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedStage === 'Post-Mobilisation'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-emerald-700'
              }`}
            >
              Post-Mobilisation
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2.5">
          {/* 1. Stage Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Stage</label>
            <select
              id="dashboard-stage-dropdown"
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value as any)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Stages</option>
              <option value="Pre-Mobilisation">Pre-Mobilisation</option>
              <option value="Post-Mobilisation">Post-Mobilisation</option>
            </select>
          </div>

          {/* 2. Project */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Project</label>
            <select
              id="dashboard-project-filter"
              value={selectedProject}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Projects</option>
              {uniqueProjects.map((pName) => (
                <option key={pName} value={pName}>
                  {pName}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Phase */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Phase {isDduGkySelected && <span className="text-amber-600">*</span>}
            </label>
            <select
              id="dashboard-phase-filter"
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              disabled={isCsrSelected || isRtdSelected}
              className={`w-full text-xs border rounded-xl p-2 font-medium focus:ring-1 focus:ring-blue-500 ${
                isDduGkySelected && selectedPhase === 'All'
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                  : 'bg-gray-50 border-gray-200'
              } disabled:opacity-50 disabled:bg-gray-100`}
            >
              <option value="All">
                {isCsrSelected || isRtdSelected ? 'N/A' : isDduGkySelected ? 'Select Phase' : 'All Phases'}
              </option>
              {!isCsrSelected &&
                !isRtdSelected &&
                DDU_GKY_PHASES.map((ph) => (
                  <option key={ph} value={ph}>
                    {ph}
                  </option>
                ))}
            </select>
          </div>

          {/* 4. Cycle */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Cycle {isDduGkySelected && <span className="text-amber-600">*</span>}
            </label>
            <select
              id="dashboard-cycle-filter"
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              disabled={isCsrSelected || isRtdSelected}
              className={`w-full text-xs border rounded-xl p-2 font-medium focus:ring-1 focus:ring-blue-500 ${
                isDduGkySelected && selectedCycle === 'All'
                  ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                  : 'bg-gray-50 border-gray-200'
              } disabled:opacity-50 disabled:bg-gray-100`}
            >
              <option value="All">
                {isCsrSelected || isRtdSelected ? 'N/A' : isDduGkySelected ? 'Select Cycle' : 'All Cycles'}
              </option>
              {!isCsrSelected &&
                !isRtdSelected &&
                DDU_GKY_CYCLES.map((cy) => (
                  <option key={cy} value={cy}>
                    {cy}
                  </option>
                ))}
            </select>
          </div>

          {/* 5. State */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-600">State</label>
              {isStateLocked && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">Locked</span>
              )}
            </div>
            <select
              id="dashboard-state-filter"
              value={effectiveState}
              onChange={(e) => handleStateChange(e.target.value)}
              disabled={isStateLocked}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75 disabled:bg-slate-100 cursor-pointer"
            >
              {!isStateLocked && <option value="All">All States</option>}
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st} {isStateLocked && st === effectiveState ? '(Assigned State)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 6. District */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">District</label>
            <select
              id="dashboard-district-filter"
              value={selectedDistrict}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Districts</option>
              {availableDistricts.map((dName) => (
                <option key={dName} value={dName}>
                  {dName}
                </option>
              ))}
            </select>
          </div>

          {/* 7. Block */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Block</label>
            <select
              id="dashboard-block-filter"
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Blocks</option>
              {availableBlocks.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* 8. Batch */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Batch</label>
            <select
              id="dashboard-batch-filter"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              disabled={isCsrSelected}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75"
            >
              <option value="All">All Batches</option>
              {availableBatches.map((bName) => (
                <option key={bName} value={bName}>
                  {bName}
                </option>
              ))}
            </select>
          </div>

          {/* 9. Mobiliser */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mobiliser</label>
            <select
              id="dashboard-mobiliser-filter"
              value={selectedMobiliser}
              onChange={(e) => setSelectedMobiliser(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl p-2 font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Mobilisers</option>
              {availableMobilisers.map((m, idx) => (
                <option key={`dash-mob-${m.id}-${idx}`} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* DDU-GKY 2.0 Mandatory Selection Notice */}
        {isPhaseCycleMissing && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Filter className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">Please select Phase and Cycle to view candidates.</p>
              <p className="text-[11px] text-amber-700">
                For DDU-GKY 2.0, both Phase and Cycle are mandatory filters before cohort data, metrics, and candidate records can be displayed.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- KPI CARDS (STAGE CONTEXT-AWARE) ---------------- */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {selectedStage === 'Pre-Mobilisation'
                ? 'Pre-Mobilisation Pipeline Metrics'
                : selectedStage === 'Post-Mobilisation'
                ? 'Post-Mobilisation Progression Metrics'
                : 'Candidate Pipeline Metrics'}
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              selectedStage === 'Pre-Mobilisation'
                ? 'bg-blue-100 text-blue-800'
                : selectedStage === 'Post-Mobilisation'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {selectedStage === 'All' ? 'All Workflow' : selectedStage}
            </span>
          </div>

          <span className="text-xs font-semibold text-blue-600">
            {selectedStage === 'Post-Mobilisation'
              ? `Placement Rate: ${kpis.placementRate}% | Completion: ${kpis.total > 0 ? Math.round((kpis.trainingCompleted / kpis.total) * 100) : 0}%`
              : `Conversion: ${kpis.conversionRate}% | Doc Completion: ${kpis.docCompletionRate}%`}
          </span>
        </div>

        {selectedStage === 'Pre-Mobilisation' ? (
          /* PRE-MOBILISATION SPECIFIC KPI GRID */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Leads */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Total Leads</span>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900">{kpis.total}</span>
                <span className="text-[11px] text-gray-400 font-medium">Pre-Mobilisation</span>
              </div>
            </div>

            {/* Contacted */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Contacted</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <PhoneCall className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-indigo-600">{kpis.contacted}</span>
                <span className="text-[11px] text-indigo-500 font-medium">Outreached</span>
              </div>
            </div>

            {/* Interested */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Interested</span>
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <ThumbsUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-sky-600">{kpis.interested}</span>
                <span className="text-[11px] text-sky-600 font-medium">Expressed interest</span>
              </div>
            </div>

            {/* Follow-up Required */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Follow-up Req.</span>
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-amber-700">{kpis.followUpRequired}</span>
                <span className="text-[11px] text-amber-600 font-medium">Call later</span>
              </div>
            </div>

            {/* Confirmed */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Confirmed</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-700">{kpis.confirmed}</span>
                <span className="text-[11px] text-emerald-600 font-semibold">{kpis.conversionRate}% Conv.</span>
              </div>
            </div>

            {/* Documents Pending */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Docs Pending</span>
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-amber-700">{kpis.docsPending}</span>
                <span className="text-[11px] text-amber-600 font-medium">Incomplete KYC</span>
              </div>
            </div>

            {/* Documents Complete */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Docs Complete</span>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <FileCheck2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-blue-600">{kpis.docsComplete}</span>
                <span className="text-[11px] text-blue-600 font-medium">{kpis.docCompletionRate}% of conf.</span>
              </div>
            </div>

            {/* Pre-Mobilisation Conversion Rate */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Conversion Rate</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-700">{kpis.conversionRate}%</span>
                <span className="text-[11px] text-emerald-600 font-medium">Leads to Confirmed</span>
              </div>
            </div>

            {/* Dropouts */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Dropouts / Uninterested</span>
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <UserX className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-rose-700">{kpis.dropouts}</span>
                <span className="text-[11px] text-rose-500 font-medium">Lost leads</span>
              </div>
            </div>

            {/* Mobilisation Target Card */}
            <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-900">Pre-Mob Target</span>
                <Award className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-blue-900">
                  {Math.round((kpis.confirmed / 200) * 100)}%
                </span>
                <span className="text-[11px] text-blue-700 font-semibold">{kpis.confirmed} / 200 Target</span>
              </div>
            </div>
          </div>
        ) : selectedStage === 'Post-Mobilisation' ? (
          /* POST-MOBILISATION SPECIFIC KPI GRID */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Confirmed Candidates Entering Post-Mobilisation */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Confirmed (Intake)</span>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-blue-700">{kpis.confirmed}</span>
                <span className="text-[11px] text-gray-400 font-medium">Entered Post-Mob</span>
              </div>
            </div>

            {/* Screening Pending */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Screening Pending</span>
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-amber-700">{kpis.screeningPending}</span>
                <span className="text-[11px] text-amber-600 font-medium">Awaiting evaluation</span>
              </div>
            </div>

            {/* Screened & Eligible */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Screened & Eligible</span>
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-purple-700">{kpis.screened}</span>
                <span className="text-[11px] text-purple-600 font-medium">Passed interview</span>
              </div>
            </div>

            {/* Ready for Batch */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Ready for Batch</span>
                <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                  <UserCheck2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-teal-700">{kpis.readyForBatch}</span>
                <span className="text-[11px] text-teal-600 font-medium">Cleared for cohort</span>
              </div>
            </div>

            {/* Batch Assigned */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Batch Assigned</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-indigo-700">{kpis.batchAssigned}</span>
                <span className="text-[11px] text-indigo-600 font-medium">Enrolled</span>
              </div>
            </div>

            {/* In Training */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">In Training</span>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-blue-700">{kpis.inTraining}</span>
                <span className="text-[11px] text-blue-600 font-medium">Active coursework</span>
              </div>
            </div>

            {/* Training Completed */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Training Completed</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-700">{kpis.trainingCompleted}</span>
                <span className="text-[11px] text-emerald-600 font-medium">Certified graduates</span>
              </div>
            </div>

            {/* Placed Candidates */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Placed Candidates</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-800">{kpis.placed}</span>
                <span className="text-[11px] text-emerald-600 font-semibold">{kpis.placementRate}% Placed</span>
              </div>
            </div>

            {/* Placement Rate */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Placement Success</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-700">{kpis.placementRate}%</span>
                <span className="text-[11px] text-emerald-600 font-medium">Of Completed</span>
              </div>
            </div>

            {/* Post-Mobilisation Dropouts */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Dropouts</span>
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <UserX className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-rose-700">{kpis.dropouts}</span>
                <span className="text-[11px] text-rose-500 font-medium">Training/post dropouts</span>
              </div>
            </div>
          </div>
        ) : (
          /* ALL WORKFLOW KPI GRID */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Leads */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Total Leads</span>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900">{kpis.total}</span>
                <span className="text-[11px] text-gray-400 font-medium">All registered</span>
              </div>
            </div>

            {/* Interested */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Interested</span>
                <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
                  <ThumbsUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-sky-600">{kpis.interested}</span>
                <span className="text-[11px] text-sky-600 font-medium">Expressed interest</span>
              </div>
            </div>

            {/* Confirmed */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Confirmed</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-700">{kpis.confirmed}</span>
                <span className="text-[11px] text-emerald-600 font-semibold">{kpis.conversionRate}% Conv.</span>
              </div>
            </div>

            {/* Documents Complete */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Docs Complete</span>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <FileCheck2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-blue-600">{kpis.docsComplete}</span>
                <span className="text-[11px] text-blue-600 font-medium">{kpis.docCompletionRate}% of conf.</span>
              </div>
            </div>

            {/* Screening Completed */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Screening Done</span>
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
                  <GraduationCap className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-purple-700">{kpis.screened}</span>
                <span className="text-[11px] text-purple-600 font-medium">Passed interview</span>
              </div>
            </div>

            {/* Batch Assigned */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Batch Assigned</span>
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-amber-700">{kpis.batchAssigned}</span>
                <span className="text-[11px] text-amber-600 font-medium">Enrolled</span>
              </div>
            </div>

            {/* Training Completed */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Training Completed</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-700">{kpis.trainingCompleted}</span>
                <span className="text-[11px] text-emerald-600 font-medium">Certified graduates</span>
              </div>
            </div>

            {/* Placed */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Placed</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Briefcase className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-800">{kpis.placed}</span>
                <span className="text-[11px] text-emerald-600 font-semibold">{kpis.placementRate}% Placed</span>
              </div>
            </div>

            {/* Dropouts */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Dropouts</span>
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <UserX className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-rose-700">{kpis.dropouts}</span>
                <span className="text-[11px] text-rose-500 font-medium">
                  {kpis.total > 0 ? Math.round((kpis.dropouts / kpis.total) * 100) : 0}% of leads
                </span>
              </div>
            </div>

            {/* Overall Mobilisation Target Card */}
            <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-100 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-900">Overall Target</span>
                <Award className="w-4 h-4 text-blue-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-blue-900">
                  {Math.round((kpis.confirmed / 200) * 100)}%
                </span>
                <span className="text-[11px] text-blue-700 font-semibold">{kpis.confirmed} / 200 Target</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- CANDIDATE FUNNEL VISUALIZATION (SECTION 5) ---------------- */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {selectedStage === 'Pre-Mobilisation'
                ? 'Pre-Mobilisation Conversion Funnel'
                : selectedStage === 'Post-Mobilisation'
                ? 'Post-Mobilisation Progression Funnel'
                : 'Candidate Mobilisation & Placement Funnel'}
            </h3>
            <p className="text-xs text-gray-500">
              {selectedStage === 'Pre-Mobilisation'
                ? 'Lead generation, tele-calling outreach, interest confirmation, and documentation'
                : selectedStage === 'Post-Mobilisation'
                ? 'Center screening, batch assignment, skilling execution, and final placement'
                : 'End-to-end conversion journey from first outreach to employment'}
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            {kpis.total} Total Pipeline Candidates
          </span>
        </div>

        {/* Responsive Funnel Bars */}
        <div className="space-y-2.5">
          {kpis.funnel.map((item, idx) => {
            const maxVal = kpis.total || 1;
            const pctOfTotal = Math.round((item.count / maxVal) * 100);
            const prevItem = idx > 0 ? kpis.funnel[idx - 1] : null;
            const stepConversion = prevItem && prevItem.count > 0 ? Math.round((item.count / prevItem.count) * 100) : 100;

            return (
              <div key={item.stage} className="flex items-center gap-3">
                <div className="w-32 sm:w-44 text-xs font-semibold text-slate-700 truncate text-left">
                  {item.stage}
                </div>
                <div className="flex-1 bg-gray-100 rounded-xl h-8 relative overflow-hidden flex items-center px-3">
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-xl transition-all duration-500 bg-blue-600"
                    style={{ width: `${Math.max(pctOfTotal, 3)}%` }}
                  ></div>
                  <div className="relative z-10 flex items-center justify-between w-full text-xs font-bold">
                    <span className={pctOfTotal > 12 ? 'text-white' : 'text-slate-800 pl-1'}>
                      {item.count}
                    </span>
                    <span className="text-[11px] font-medium text-slate-600 bg-white/90 px-2 py-0.5 rounded-md shadow-2xs">
                      {pctOfTotal}% of total
                    </span>
                  </div>
                </div>
                <div className="w-16 sm:w-20 text-right text-[11px] font-semibold text-gray-500 shrink-0">
                  {idx === 0 ? 'Baseline' : `${stepConversion}%`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- DISTRICT PERFORMANCE SNAPSHOT (SECTION 6 - ADMIN ONLY) ---------------- */}
      {!isMobiliser && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* District Performance Summary */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">District Mobilisation Progress</h3>
                <p className="text-xs text-gray-500">Confirmed vs Target achievement by district</p>
              </div>
              <button
                onClick={() => onNavigate('districts')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                Full Details <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {districtPerformance.slice(0, 5).map((d) => (
                <div key={d.district} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{d.district}</span>
                    <span className="text-gray-500 font-medium">
                      <span className="font-bold text-slate-900">{d.confirmed}</span> / {d.target} Confirmed
                      <span className="ml-2 font-bold text-blue-600">({d.achievement}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${
                        d.achievement >= 75 ? 'bg-emerald-500' : d.achievement >= 50 ? 'bg-blue-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(d.achievement, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Mobilisers Leaderboard */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Mobiliser Performance</h3>
                <p className="text-xs text-gray-500">Top mobilisers by confirmed conversions</p>
              </div>
              <button
                onClick={() => onNavigate('mobilisers')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                All Mobilisers <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {mobiliserPerformance.slice(0, 5).map((m, idx) => (
                <div key={`dash-perf-${m.id}-${idx}`} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      idx === 0 ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{m.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{m.district} • {m.leads} Leads</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900">{m.confirmed} Confirmed</span>
                    <p className="text-[11px] font-semibold text-emerald-600">{m.achievement}% Target</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- RECENT MOBILISATION ACTIVITY FEED ---------------- */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Candidates Registered</h3>
            <p className="text-xs text-gray-500">Newly identified leads across all operational districts</p>
          </div>
          <button
            onClick={() => onNavigate('candidates')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            View All Students <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isPhaseCycleMissing ? (
          <div className="py-8 text-center text-gray-500">
            <p className="text-xs font-semibold text-amber-800">Please select Phase and Cycle to view candidates.</p>
          </div>
        ) : filteredDashboardCandidates.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs">
            No candidates matching current filter criteria.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredDashboardCandidates.slice(0, 6).map((cand) => (
              <div
                key={cand.id}
                onClick={() => onSelectCandidate(cand.id)}
                className="py-3 flex items-center justify-between text-xs hover:bg-gray-50 px-3 rounded-xl transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-gray-400">{cand.candidateId}</span>
                    <span className="font-bold text-slate-900 truncate">{cand.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                      {cand.gender}
                    </span>
                    {cand.project && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {cand.project}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {cand.district} ({cand.block}) • Mobiliser: <span className="font-medium text-slate-700">{cand.assignedMobiliserName}</span>
                    {cand.batch ? ` • ${cand.batch}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                    cand.currentStatus === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' :
                    cand.currentStatus === 'Interested' ? 'bg-blue-50 text-blue-700' :
                    cand.currentStatus === 'Reported' ? 'bg-purple-50 text-purple-700' :
                    cand.currentStatus === 'Documents Pending' ? 'bg-amber-50 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {cand.currentStatus}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
