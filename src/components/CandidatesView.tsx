import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  Phone,
  MessageSquare,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  LayoutGrid,
  List,
  Eye,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  Layers,
  Trash2,
} from 'lucide-react';
import {
  Candidate,
  CandidateStatus,
  User,
  CandidateStage,
  PRE_MOBILISATION_STATUSES,
  POST_MOBILISATION_STATUSES,
  PROJECT_OPTIONS,
  DDU_GKY_PHASES,
  DDU_GKY_CYCLES,
  BATCH_OPTIONS,
  CSR_BATCH_MAPPING,
} from '../types';
import { dataStore } from '../services/dataStore';
import { exportCandidateMasterCSV } from '../utils/exportUtils';
import { getAllStates, getDistrictsForState, getBlocksForDistrict } from '../utils/locationData';

interface CandidatesViewProps {
  currentUser: User;
  onSelectCandidate: (candidateId: string) => void;
  onOpenAddStudent?: () => void;
  onOpenAddCandidate?: () => void;
}

export const CandidatesView: React.FC<CandidatesViewProps> = ({
  currentUser,
  onSelectCandidate,
  onOpenAddStudent,
  onOpenAddCandidate,
}) => {
  const handleOpenAddStudent = onOpenAddStudent || onOpenAddCandidate;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<'All' | 'Pre-Mobilisation' | 'Post-Mobilisation'>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedProject, setSelectedProject] = useState<string>('All');
  const [selectedPhase, setSelectedPhase] = useState<string>('All');
  const [selectedCycle, setSelectedCycle] = useState<string>('All');
  const [selectedBatch, setSelectedBatch] = useState<string>('All');

  // State-Based Access Control: If user is state mobiliser, lock state filter to their state
  const isStateLocked = currentUser.role !== 'admin' && Boolean(currentUser.state) && currentUser.state !== 'All';
  const initialUserState = isStateLocked ? (currentUser.state || 'Nagaland') : 'All';
  const [selectedState, setSelectedState] = useState<string>(initialUserState);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('All');
  const [selectedBlock, setSelectedBlock] = useState<string>('All');
  const [selectedMobiliser, setSelectedMobiliser] = useState<string>('All');
  const [selectedEligibility, setSelectedEligibility] = useState<string>('All');
  const [selectedGender, setSelectedGender] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [showFilters, setShowFilters] = useState(false);

  // Changing Project resets Phase, Cycle, and Batch to All
  const handleProjectChange = (newProj: string) => {
    setSelectedProject(newProj);
    setSelectedPhase('All');
    setSelectedCycle('All');
    setSelectedBatch('All');
  };

  const effectiveState = isStateLocked ? (currentUser.state || 'Nagaland') : selectedState;

  const districts = dataStore.getDistricts();
  const projects = dataStore.getProjects();
  const uniqueProjects = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.name)));
  }, [projects]);
  const availableStates = useMemo(() => getAllStates(), []);

  // Compute available districts based on effectiveState
  const availableDistricts = useMemo(() => {
    if (effectiveState === 'All') return districts.map((d) => d.name);
    return getDistrictsForState(effectiveState);
  }, [effectiveState, districts]);

  // Compute available field mobilisers based on effectiveState (Requirement 5: A state mobiliser can see candidates assigned to all mobilisers within their own state)
  const availableMobilisers = useMemo(() => {
    const st = effectiveState === 'All' ? undefined : effectiveState;
    return dataStore.getFieldMobilisers(st, false);
  }, [effectiveState]);

  // Admin In-App Delete Confirmation State (Bypasses iframe window.confirm blocks)
  const [candidateToDelete, setCandidateToDelete] = useState<{
    id: string;
    name: string;
    candCode: string;
  } | null>(null);

  const handleDeleteCandidate = (candidateId: string, name: string, candCode: string) => {
    if (currentUser.role !== 'admin') {
      return;
    }
    setCandidateToDelete({ id: candidateId, name, candCode });
  };

  const confirmDeleteCandidate = () => {
    if (!candidateToDelete) return;
    dataStore.deleteCandidate(candidateToDelete.id);
    setCandidateToDelete(null);
  };

  // Compute available batches based on selectedProject
  const availableBatches = useMemo(() => {
    if (selectedProject !== 'All' && CSR_BATCH_MAPPING[selectedProject]) {
      return [CSR_BATCH_MAPPING[selectedProject]];
    }
    if (selectedProject === 'DDU-GKY 2.0' || selectedProject === 'All') {
      return BATCH_OPTIONS;
    }
    return [];
  }, [selectedProject]);

  // Handle stage switching with context-aware status reset
  const handleStageChange = (newStage: 'All' | 'Pre-Mobilisation' | 'Post-Mobilisation') => {
    setSelectedStage(newStage);
    if (newStage === 'Pre-Mobilisation') {
      if (selectedStatus !== 'All' && !PRE_MOBILISATION_STATUSES.includes(selectedStatus as any)) {
        setSelectedStatus('All');
      }
    } else if (newStage === 'Post-Mobilisation') {
      if (selectedStatus !== 'All' && !POST_MOBILISATION_STATUSES.includes(selectedStatus as any)) {
        setSelectedStatus('All');
      }
    }
  };

  // Handle cascading when State changes
  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    if (newState !== 'All') {
      const stateDistricts = getDistrictsForState(newState);
      if (selectedDistrict !== 'All' && !stateDistricts.includes(selectedDistrict)) {
        setSelectedDistrict('All');
        setSelectedBlock('All');
      }
    }
  };

  // Handle cascading when District changes
  const handleDistrictChange = (newDistrict: string) => {
    setSelectedDistrict(newDistrict);
    if (newDistrict !== 'All') {
      const districtBlocks = getBlocksForDistrict(newDistrict, selectedState);
      if (selectedBlock !== 'All' && !districtBlocks.includes(selectedBlock)) {
        setSelectedBlock('All');
      }
    } else {
      setSelectedBlock('All');
    }
  };

  const [candidates, setCandidates] = useState<Candidate[]>(() => dataStore.getCandidates(currentUser));
  const [isSyncing, setIsSyncing] = useState<boolean>(() => dataStore.getIsSyncingRemoteCandidates());
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Subscribe to dataStore for real-time reactive updates
  React.useEffect(() => {
    setCandidates(dataStore.getCandidates(currentUser));
    setIsSyncing(dataStore.getIsSyncingRemoteCandidates());

    const unsubscribe = dataStore.subscribe(() => {
      setCandidates(dataStore.getCandidates(currentUser));
      setIsSyncing(dataStore.getIsSyncingRemoteCandidates());
    });
    return unsubscribe;
  }, [currentUser]);

  const handleManualRefresh = async () => {
    setSyncNotice(null);
    const res = await dataStore.syncCandidatesFromGoogleSheets();
    if (res.success) {
      setSyncNotice(`Retrieved latest candidates from Google Sheets (${res.count} total records)`);
      setTimeout(() => setSyncNotice(null), 3500);
    } else if (res.error) {
      setSyncNotice(`Google Sheets Notice: ${res.error}`);
      setTimeout(() => setSyncNotice(null), 4500);
    }
  };

  // Count candidates by stage
  const stageCounts = useMemo(() => {
    let pre = 0;
    let post = 0;
    candidates.forEach((c) => {
      const st = c.stage || (POST_MOBILISATION_STATUSES.includes(c.currentStatus as any) ? 'Post-Mobilisation' : 'Pre-Mobilisation');
      if (st === 'Post-Mobilisation') post++;
      else pre++;
    });
    return { all: candidates.length, pre, post };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Stage Filter
      if (selectedStage !== 'All') {
        const candidateStage = c.stage || (POST_MOBILISATION_STATUSES.includes(c.currentStatus as any) ? 'Post-Mobilisation' : 'Pre-Mobilisation');
        if (candidateStage !== selectedStage) {
          return false;
        }
      }

      // Search
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchName = c.name.toLowerCase().includes(query);
        const matchId = c.candidateId.toLowerCase().includes(query);
        const matchPhone = c.phone.includes(query) || (c.alternatePhone && c.alternatePhone.includes(query));
        const matchVillage = c.village.toLowerCase().includes(query);
        const matchFather = c.fatherName?.toLowerCase().includes(query);
        if (!matchName && !matchId && !matchPhone && !matchVillage && !matchFather) {
          return false;
        }
      }

      // Status
      if (selectedStatus !== 'All' && c.currentStatus !== selectedStatus) {
        return false;
      }
      // Project
      if (selectedProject !== 'All') {
        const cProj = c.project || c.projectName || c.programme;
        if (cProj !== selectedProject) return false;
      }
      // Phase
      if (selectedPhase !== 'All') {
        if (c.phase !== selectedPhase) return false;
      }
      // Cycle
      if (selectedCycle !== 'All') {
        if (c.cycle !== selectedCycle) return false;
      }
      // Batch
      if (selectedBatch !== 'All') {
        const cBatch = c.batch || c.batchName;
        if (cBatch !== selectedBatch) return false;
      }
      // State
      if (effectiveState !== 'All') {
        const stateLower = effectiveState.trim().toLowerCase();
        if ((c.state || '').trim().toLowerCase() !== stateLower) {
          return false;
        }
      }
      // District
      if (selectedDistrict !== 'All' && c.district !== selectedDistrict) {
        return false;
      }
      // Block
      if (selectedBlock !== 'All' && c.block !== selectedBlock) {
        return false;
      }
      // Mobiliser (Matches assigned field mobiliser by ID or Name)
      if (selectedMobiliser !== 'All') {
        const mob = availableMobilisers.find((m) => m.id === selectedMobiliser);
        const mobName = mob ? mob.name.toLowerCase() : selectedMobiliser.toLowerCase();
        const candMobId = (c.assignedMobiliserId || '').toLowerCase();
        const candMobName = (c.assignedMobiliserName || '').toLowerCase();
        if (candMobId !== selectedMobiliser.toLowerCase() && candMobName !== mobName) {
          return false;
        }
      }
      // Eligibility
      if (selectedEligibility !== 'All' && c.eligibilityStatus !== selectedEligibility) {
        return false;
      }
      // Gender
      if (selectedGender !== 'All' && c.gender !== selectedGender) {
        return false;
      }

      return true;
    });
  }, [
    candidates,
    selectedStage,
    searchQuery,
    selectedStatus,
    selectedProject,
    selectedPhase,
    selectedCycle,
    selectedBatch,
    effectiveState,
    selectedDistrict,
    selectedBlock,
    selectedMobiliser,
    availableMobilisers,
    selectedEligibility,
    selectedGender,
  ]);

  const availableBlocks = useMemo(() => {
    if (selectedDistrict === 'All') {
      if (effectiveState !== 'All') {
        const dists = getDistrictsForState(effectiveState);
        return Array.from(new Set(dists.flatMap((dName) => getBlocksForDistrict(dName, effectiveState))));
      }
      return Array.from(new Set(districts.flatMap((d) => d.blocks)));
    }
    return getBlocksForDistrict(selectedDistrict, effectiveState);
  }, [selectedDistrict, effectiveState, districts]);

  const handleExport = () => {
    exportCandidateMasterCSV(filteredCandidates);
  };

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Student & Candidate Master</h2>
            {isSyncing && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 animate-pulse">
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-blue-600" />
                Syncing Google Sheets
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {filteredCandidates.length} candidates in database • Single source of truth
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh Button - retrieves latest data from Google Sheets */}
          <button
            id="refresh-candidates-btn"
            onClick={handleManualRefresh}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs cursor-pointer transition-colors disabled:opacity-60"
            title="Retrieve latest candidates from Google Sheets"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
            className="p-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
            title={viewMode === 'table' ? 'Switch to Card View' : 'Switch to Table View'}
          >
            {viewMode === 'table' ? <LayoutGrid className="w-4 h-4" /> : <List className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            id="add-candidate-master-btn"
            onClick={handleOpenAddStudent}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Loading state indicator while refreshed candidate data is being retrieved */}
      {isSyncing && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/90 border border-blue-200/80 rounded-xl text-xs text-blue-800 font-medium animate-pulse shadow-xs">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
            <span>Retrieving refreshed candidate data from Google Sheets...</span>
          </div>
          <span className="text-[11px] text-blue-600 font-semibold hidden sm:inline">Updating Candidate Directory</span>
        </div>
      )}

      {/* Sync Status Feedback Notice */}
      {syncNotice && !isSyncing && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <button
            onClick={() => setSyncNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
        {/* Workflow Stage Filter Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-1.5 p-1 bg-gray-100/90 rounded-xl">
            <button
              onClick={() => handleStageChange('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStage === 'All'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-gray-600 hover:text-slate-900'
              }`}
            >
              All Stages ({stageCounts.all})
            </button>
            <button
              onClick={() => handleStageChange('Pre-Mobilisation')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStage === 'Pre-Mobilisation'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-blue-700'
              }`}
            >
              <span>Pre-Mobilisation</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedStage === 'Pre-Mobilisation' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'
              }`}>
                {stageCounts.pre}
              </span>
            </button>
            <button
              onClick={() => handleStageChange('Post-Mobilisation')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStage === 'Post-Mobilisation'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 hover:text-emerald-700'
              }`}
            >
              <span>Post-Mobilisation</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedStage === 'Post-Mobilisation' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {stageCounts.post}
              </span>
            </button>
          </div>

          <span className="text-[11px] text-gray-400 font-medium">
            Showing <strong className="text-slate-700">{filteredCandidates.length}</strong> of {candidates.length} candidates
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by candidate name, ID (e.g. NG-2026-00001), phone, village, father's name..."
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-2.5 text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter dropdowns (collapsible on mobile) */}
        {(showFilters || window.innerWidth > 768) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 pt-3 border-t border-gray-100">
            {/* 1. Stage Selector */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">1. Stage</label>
              <select
                value={selectedStage}
                onChange={(e) => handleStageChange(e.target.value as any)}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="All">All Stages</option>
                <option value="Pre-Mobilisation">Pre-Mobilisation</option>
                <option value="Post-Mobilisation">Post-Mobilisation</option>
              </select>
            </div>

            {/* 2. Project */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">2. Project</label>
              <select
                id="candidates-project-filter"
                value={selectedProject}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
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
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                3. Phase {selectedProject !== 'All' && selectedProject !== 'DDU-GKY 2.0' ? '(N/A)' : ''}
              </label>
              <select
                id="candidates-phase-filter"
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(e.target.value)}
                disabled={selectedProject !== 'All' && selectedProject !== 'DDU-GKY 2.0'}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-50"
              >
                <option value="All">All Phases</option>
                {DDU_GKY_PHASES.map((ph) => (
                  <option key={ph} value={ph}>
                    {ph}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Cycle */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                4. Cycle {selectedProject !== 'All' && selectedProject !== 'DDU-GKY 2.0' ? '(N/A)' : ''}
              </label>
              <select
                id="candidates-cycle-filter"
                value={selectedCycle}
                onChange={(e) => setSelectedCycle(e.target.value)}
                disabled={selectedProject !== 'All' && selectedProject !== 'DDU-GKY 2.0'}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-50"
              >
                <option value="All">All Cycles</option>
                {DDU_GKY_CYCLES.map((cy) => (
                  <option key={cy} value={cy}>
                    {cy}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. State */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">5. State</label>
                {isStateLocked && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">Locked</span>
                )}
              </div>
              <select
                id="candidates-state-filter"
                value={effectiveState}
                onChange={(e) => handleStateChange(e.target.value)}
                disabled={isStateLocked}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-75 disabled:bg-slate-100 cursor-pointer"
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
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">6. District</label>
              <select
                id="candidates-district-filter"
                value={selectedDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
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
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">7. Block</label>
              <select
                id="candidates-block-filter"
                value={selectedBlock}
                onChange={(e) => setSelectedBlock(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
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
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                8. Batch {selectedProject === 'RTD' ? '(TBD)' : ''}
              </label>
              <select
                id="candidates-batch-filter"
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                disabled={selectedProject === 'RTD'}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white disabled:opacity-50"
              >
                <option value="All">All Batches</option>
                {availableBatches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* 9. Mobiliser */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">9. Mobiliser</label>
              <select
                id="candidates-mobiliser-filter"
                value={selectedMobiliser}
                onChange={(e) => setSelectedMobiliser(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="All">All Mobilisers</option>
                {availableMobilisers.map((m, idx) => (
                  <option key={`cand-filter-mob-${m.id}-${idx}`} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 10. Status Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                10. Status {selectedStage !== 'All' ? `(${selectedStage.split('-')[0]})` : ''}
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="All">All Statuses</option>

                {selectedStage === 'Pre-Mobilisation' && (
                  <>
                    <option value="New Lead">New Lead</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Interested">Interested</option>
                    <option value="Call Later">Call Later</option>
                    <option value="Follow-up Required">Follow-up Required</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Documents Pending">Documents Pending</option>
                    <option value="Documents Complete">Documents Complete</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="Rejected">Rejected</option>
                  </>
                )}

                {selectedStage === 'Post-Mobilisation' && (
                  <>
                    <option value="Confirmed">Confirmed (Pre-Screening)</option>
                    <option value="Screening Pending">Screening Pending</option>
                    <option value="Screening Completed">Screening Completed</option>
                    <option value="Eligible">Eligible</option>
                    <option value="Ready for Batch">Ready for Batch</option>
                    <option value="Batch Assigned">Batch Assigned</option>
                    <option value="In Training">In Training</option>
                    <option value="Training Started">Training Started</option>
                    <option value="Training Completed">Training Completed</option>
                    <option value="Placed">Placed</option>
                    <option value="Unplaced">Unplaced</option>
                    <option value="Dropout">Dropout</option>
                  </>
                )}

                {selectedStage === 'All' && (
                  <>
                    <optgroup label="Pre-Mobilisation Statuses">
                      <option value="New Lead">New Lead</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Interested">Interested</option>
                      <option value="Call Later">Call Later</option>
                      <option value="Follow-up Required">Follow-up Required</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Documents Pending">Documents Pending</option>
                      <option value="Documents Complete">Documents Complete</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Rejected">Rejected</option>
                    </optgroup>
                    <optgroup label="Post-Mobilisation Statuses">
                      <option value="Screening Pending">Screening Pending</option>
                      <option value="Screening Completed">Screening Completed</option>
                      <option value="Eligible">Eligible</option>
                      <option value="Ready for Batch">Ready for Batch</option>
                      <option value="Batch Assigned">Batch Assigned</option>
                      <option value="In Training">In Training</option>
                      <option value="Training Started">Training Started</option>
                      <option value="Training Completed">Training Completed</option>
                      <option value="Placed">Placed</option>
                      <option value="Unplaced">Unplaced</option>
                      <option value="Dropout">Dropout</option>
                    </optgroup>
                  </>
                )}
              </select>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Gender</label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="All">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Eligibility */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Eligibility</label>
              <select
                value={selectedEligibility}
                onChange={(e) => setSelectedEligibility(e.target.value)}
                className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-blue-500 focus:bg-white"
              >
                <option value="All">All Eligibility</option>
                <option value="Eligible">Eligible</option>
                <option value="Ineligible">Ineligible</option>
                <option value="Exempted">Exempted</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ---------------- CANDIDATES LIST ---------------- */}
      {filteredCandidates.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-gray-200">
          <p className="text-sm font-semibold text-slate-700">No candidates match your filters.</p>
          <p className="text-xs text-gray-400 mt-1">Try resetting search filters or register a new candidate.</p>
          {handleOpenAddStudent && (
            <button
              onClick={handleOpenAddStudent}
              className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Student</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (Desktop / Tablet) */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Candidate</th>
                  <th className="py-3.5 px-5">Phone / WhatsApp</th>
                  <th className="py-3.5 px-5">Location</th>
                  <th className="py-3.5 px-5">Cohort Allocation</th>
                  <th className="py-3.5 px-5">Education</th>
                  <th className="py-3.5 px-5">Mobiliser</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCandidates.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCandidate(c.id)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="font-mono text-[10px] text-gray-400">
                        {c.candidateId} • {c.gender}, {c.age} yrs
                      </div>
                    </td>
                    <td className="py-3.5 px-5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{c.phone}</span>
                        <a
                          href={`https://wa.me/91${c.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:text-emerald-800 p-1 rounded-lg hover:bg-emerald-50"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-slate-800">{c.district}</div>
                      <div className="text-[11px] text-gray-400">{c.block}, {c.village}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900 text-xs">
                        {c.project || c.projectName || c.programme || 'Unallocated'}
                      </div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {c.phase && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700">
                            {c.phase}
                          </span>
                        )}
                        {c.cycle && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700">
                            {c.cycle}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {c.batch || c.batchName || 'No Batch'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-slate-800">{c.qualification || '10th Pass'}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-800">{c.assignedMobiliserName || 'Unassigned'}</div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[10px] text-gray-400">{c.leadSource}</span>
                        {(c.assignedMobiliserPhone || c.mobiliserPhone) && (
                          <span className="text-[10px] font-mono text-slate-500">
                            • 📞 {c.assignedMobiliserPhone || c.mobiliserPhone}
                          </span>
                        )}
                        {(c.assignedMobiliserState || c.mobiliserState) && (
                          <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 px-1 rounded">
                            {c.assignedMobiliserState || c.mobiliserState}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          (c.stage === 'Post-Mobilisation' || POST_MOBILISATION_STATUSES.includes(c.currentStatus as any))
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            : 'bg-blue-50 text-blue-700 border border-blue-200/80'
                        }`}>
                          {(c.stage === 'Post-Mobilisation' || POST_MOBILISATION_STATUSES.includes(c.currentStatus as any)) ? 'Post-Mob' : 'Pre-Mob'}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                          c.currentStatus === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' :
                          c.currentStatus === 'Interested' ? 'bg-blue-50 text-blue-700' :
                          c.currentStatus === 'Reported' ? 'bg-purple-50 text-purple-700' :
                          c.currentStatus === 'Documents Complete' ? 'bg-blue-50 text-blue-700' :
                          c.currentStatus === 'Batch Assigned' || c.currentStatus === 'Training Started' ? 'bg-amber-50 text-amber-700' :
                          c.currentStatus === 'Placed' || c.currentStatus === 'Training Completed' ? 'bg-emerald-50 text-emerald-700' :
                          c.currentStatus === 'Dropout' || c.currentStatus === 'Rejected' ? 'bg-rose-50 text-rose-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {c.currentStatus}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteCandidate(c.id, c.name, c.candidateId)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                            title="Delete Candidate (Admin only)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onSelectCandidate(c.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                          title="View Full Master Record"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARD VIEW (Optimized for Mobile Screens) */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredCandidates.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelectCandidate(c.id)}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{c.name}</h3>
                  <p className="font-mono text-[10px] text-gray-400 mt-0.5">
                    {c.candidateId} • {c.gender}, {c.age} yrs
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    (c.stage === 'Post-Mobilisation' || POST_MOBILISATION_STATUSES.includes(c.currentStatus as any))
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {(c.stage === 'Post-Mobilisation' || POST_MOBILISATION_STATUSES.includes(c.currentStatus as any)) ? 'Post-Mob' : 'Pre-Mob'}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    c.currentStatus === 'Confirmed' ? 'bg-emerald-50 text-emerald-700' :
                    c.currentStatus === 'Interested' ? 'bg-blue-50 text-blue-700' :
                    c.currentStatus === 'Reported' ? 'bg-purple-50 text-purple-700' :
                    c.currentStatus === 'Documents Complete' ? 'bg-blue-50 text-blue-700' :
                    c.currentStatus === 'Batch Assigned' || c.currentStatus === 'Training Started' ? 'bg-amber-50 text-amber-700' :
                    c.currentStatus === 'Placed' || c.currentStatus === 'Training Completed' ? 'bg-emerald-50 text-emerald-700' :
                    c.currentStatus === 'Dropout' || c.currentStatus === 'Rejected' ? 'bg-rose-50 text-rose-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {c.currentStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400">Location</span>
                  <p className="font-semibold text-slate-800">{c.district}, {c.block}</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">Project / Allocation</span>
                  <p className="font-semibold text-indigo-700">{c.project || c.projectName || c.programme || 'Unallocated'}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {c.phase && <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[9px]">{c.phase}</span>}
                    {c.cycle && <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[9px]">{c.cycle}</span>}
                    <span className="bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.2 rounded text-[9px]">
                      {c.batch || c.batchName || 'No Batch'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100 flex-wrap gap-1">
                <div className="text-[11px] text-gray-500">
                  <span>Mobiliser: </span>
                  <span className="font-semibold text-slate-800">{c.assignedMobiliserName || 'Unassigned'}</span>
                  {(c.assignedMobiliserPhone || c.mobiliserPhone) && (
                    <span className="font-mono text-[10px] text-slate-600 ml-1">
                      (📞 {c.assignedMobiliserPhone || c.mobiliserPhone})
                    </span>
                  )}
                  {(c.assignedMobiliserState || c.mobiliserState) && (
                    <span className="ml-1 text-[9px] bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded font-semibold">
                      {c.assignedMobiliserState || c.mobiliserState}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => handleDeleteCandidate(c.id, c.name, c.candidateId)}
                      className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100"
                      title="Delete Candidate (Admin only)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <a
                    href={`tel:${c.phone.replace(/\D/g, '')}`}
                    className="p-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100"
                    title="Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`https://wa.me/91${c.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100"
                    title="WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => onSelectCandidate(c.id)}
                    className="p-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
                    title="View"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Delete Candidate In-App Modal (Works reliably in iframe sandboxes) */}
      {candidateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Candidate Record</h3>
                <p className="text-xs text-slate-500 font-mono">{candidateToDelete.candCode}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900">{candidateToDelete.name}</strong>?
              This will remove the candidate and all linked documents, call logs, and follow-ups. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCandidateToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-candidate-btn"
                onClick={confirmDeleteCandidate}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
