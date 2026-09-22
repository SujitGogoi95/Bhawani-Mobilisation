import React, { useState, useMemo, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Edit2,
  Trash2,
  Calendar,
  Target,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Sparkles,
  Users,
  MapPin,
  Filter,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { Project, User as UserType, STANDARD_YEAR_OPTIONS } from '../types';
import { getStateForDistrict, MASTER_LOCATION_DATA } from '../utils/locationData';
import { DUPLICATE_PROGRAMME_CONFIG_ERROR } from '../utils/programmeUtils';

interface ProgrammeManagementViewProps {
  currentUser: UserType;
}

// Available states derived from system location master plus 'All States'
const AVAILABLE_STATES: string[] = [
  'All States',
  'Assam',
  'Meghalaya',
  'Nagaland',
  'Manipur',
];

export const ProgrammeManagementView: React.FC<ProgrammeManagementViewProps> = ({ currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Upcoming' | 'Completed'>('All');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('All');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('All');
  const [storeVersion, setStoreVersion] = useState(0);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form Fields in exact order:
  // 1. Programme / Project Name
  // 2. State
  // 3. Year
  // 4. Phase(s)
  // 5. Cycle(s)
  // 6. Status
  // 7. Mobilisation Target
  // 8. Start Date
  // 9. End Date
  const [formName, setFormName] = useState('');
  const [formState, setFormState] = useState('All States');
  const [formYear, setFormYear] = useState('2026-27');
  const [formPhases, setFormPhases] = useState<string[]>(['Phase 1']);
  const [phaseInput, setPhaseInput] = useState('');
  const [formCycles, setFormCycles] = useState<string[]>(['Cycle 1']);
  const [cycleInput, setCycleInput] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Upcoming' | 'Completed'>('Active');
  const [formTarget, setFormTarget] = useState<number>(100);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // In-app Delete Confirmation (no window.confirm)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live duplicate check for Programme + State + Year + Phase + Cycle
  const configurationDuplicateWarning = useMemo(() => {
    if (!isModalOpen || !formName.trim()) return null;
    const primaryPhase = formPhases.length > 0 ? formPhases[0] : undefined;
    const primaryCycle = formCycles.length > 0 ? formCycles[0] : undefined;
    const check = dataStore.checkProgrammeConfigurationDuplicate({
      name: formName.trim(),
      state: formState.trim(),
      year: formYear.trim(),
      phase: primaryPhase,
      cycle: primaryCycle,
      phases: formPhases,
      cycles: formCycles,
      excludeProjectId: editingProject?.id,
    });
    if (check.isDuplicate) {
      return DUPLICATE_PROGRAMME_CONFIG_ERROR;
    }
    return null;
  }, [isModalOpen, formName, formState, formYear, formPhases, formCycles, editingProject]);

  useEffect(() => {
    const unsub = dataStore.subscribe(() => setStoreVersion((v) => v + 1));
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch all programmes and candidates
  const allProjects = useMemo(() => {
    return dataStore.getProjects();
  }, [storeVersion]);

  const candidates = useMemo(() => {
    return dataStore.getCandidates();
  }, [storeVersion]);

  // Compute candidate stats for each programme record
  const programmeRecordStats = useMemo(() => {
    const stats: Record<string, { total: number; confirmed: number; reported: number }> = {};
    allProjects.forEach((p) => {
      stats[p.id] = { total: 0, confirmed: 0, reported: 0 };
    });

    candidates.forEach((c) => {
      const cProg = (c.programme || c.projectName || c.project || '').trim().toLowerCase();
      if (!cProg) return;

      const cState = (c.state || (c.district ? getStateForDistrict(c.district) : '') || '').trim().toLowerCase();
      const cYear = (c.year || '').trim().toLowerCase();

      allProjects.forEach((p) => {
        if (p.name.trim().toLowerCase() !== cProg) return;

        const pState = (p.state || 'All States').trim().toLowerCase();
        const isAllStates = pState === 'all states' || pState === 'all';
        const stateMatches = isAllStates || cState === pState;
        if (!stateMatches) return;

        // If candidate has year, match it; otherwise match state
        const pYear = (p.year || '2026-27').trim().toLowerCase();
        if (cYear && cYear !== pYear) return;

        if (!stats[p.id]) {
          stats[p.id] = { total: 0, confirmed: 0, reported: 0 };
        }
        stats[p.id].total += 1;
        if (
          [
            'Confirmed',
            'Documents Pending',
            'Documents Complete',
            'Screening Pending',
            'Screening Completed',
            'Reporting Pending',
            'Reported',
            'Batch Assigned',
            'Training Started',
            'Training Completed',
          ].includes(c.currentStatus)
        ) {
          stats[p.id].confirmed += 1;
        }
        if (
          [
            'Reported',
            'Batch Assigned',
            'Training Started',
            'Training Completed',
          ].includes(c.currentStatus)
        ) {
          stats[p.id].reported += 1;
        }
      });
    });

    return stats;
  }, [allProjects, candidates]);

  // Filtered programmes
  const filteredProjects = useMemo(() => {
    return allProjects.filter((p) => {
      if (statusFilter !== 'All' && p.status !== statusFilter) {
        return false;
      }
      if (selectedStateFilter !== 'All') {
        const pState = (p.state || 'All States').trim().toLowerCase();
        if (pState !== selectedStateFilter.toLowerCase()) {
          return false;
        }
      }
      if (selectedYearFilter !== 'All') {
        const pYear = (p.year || '2026-27').trim().toLowerCase();
        if (pYear !== selectedYearFilter.toLowerCase()) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesState = (p.state || 'All States').toLowerCase().includes(q);
        const matchesYear = (p.year || '').toLowerCase().includes(q);
        const matchesPhases = (p.phases || []).some((ph) => ph.toLowerCase().includes(q));
        const matchesCycles = (p.cycles || []).some((cy) => cy.toLowerCase().includes(q));
        return matchesName || matchesState || matchesYear || matchesPhases || matchesCycles;
      }
      return true;
    });
  }, [allProjects, statusFilter, selectedStateFilter, selectedYearFilter, searchQuery]);

  // Key Totals
  const totalTarget = useMemo(() => {
    return allProjects.reduce((acc, p) => acc + (p.target || 0), 0);
  }, [allProjects]);

  const totalMobilised = useMemo(() => {
    return Object.values(programmeRecordStats).reduce((acc: number, s: { total: number }) => acc + s.total, 0);
  }, [programmeRecordStats]);

  const activeCount = useMemo(() => {
    return allProjects.filter((p) => p.status === 'Active').length;
  }, [allProjects]);

  // Phase helpers
  const handleAddPhase = (phaseToAdd?: string) => {
    const p = (phaseToAdd !== undefined ? phaseToAdd : phaseInput).trim();
    if (!p) return;
    if (!formPhases.some((item) => item.toLowerCase() === p.toLowerCase())) {
      setFormPhases((prev) => [...prev, p]);
    }
    if (phaseToAdd === undefined) setPhaseInput('');
  };

  const handleRemovePhase = (indexToRemove: number) => {
    setFormPhases((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  // Cycle helpers
  const handleAddCycle = (cycleToAdd?: string) => {
    const c = (cycleToAdd !== undefined ? cycleToAdd : cycleInput).trim();
    if (!c) return;
    if (!formCycles.some((item) => item.toLowerCase() === c.toLowerCase())) {
      setFormCycles((prev) => [...prev, c]);
    }
    if (cycleToAdd === undefined) setCycleInput('');
  };

  const handleRemoveCycle = (indexToRemove: number) => {
    setFormCycles((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  // Modal Open Handlers
  const handleOpenAddModal = () => {
    setEditingProject(null);
    setFormName('');
    setFormState('All States');
    setFormYear('2026-27');
    setFormPhases(['Phase 1']);
    setPhaseInput('');
    setFormCycles(['Cycle 1']);
    setCycleInput('');
    setFormStatus('Active');
    setFormTarget(100);
    setFormStartDate(new Date().toISOString().split('T')[0]);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setFormEndDate(nextYear.toISOString().split('T')[0]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (proj: Project) => {
    setEditingProject(proj);
    setFormName(proj.name);
    setFormState(proj.state || 'All States');
    setFormYear(proj.year || '2026-27');
    const existingPhases = Array.isArray(proj.phases) && proj.phases.length > 0
      ? [...proj.phases]
      : (proj.phase ? [proj.phase] : ['Phase 1']);
    setFormPhases(existingPhases);
    setPhaseInput('');
    const existingCycles = Array.isArray(proj.cycles) && proj.cycles.length > 0
      ? [...proj.cycles]
      : (proj.cycle ? [proj.cycle] : ['Cycle 1']);
    setFormCycles(existingCycles);
    setCycleInput('');
    setFormStatus(proj.status);
    setFormTarget(proj.target || 100);
    setFormStartDate(proj.startDate || '');
    setFormEndDate(proj.endDate || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Programme / Project Name is required.');
      return;
    }

    const trimmedState = formState.trim();
    if (!trimmedState) {
      setFormError('State selection is required.');
      return;
    }

    const trimmedYear = formYear.trim();
    if (!trimmedYear) {
      setFormError('Year selection is required.');
      return;
    }

    const targetNum = Number(formTarget);
    if (isNaN(targetNum) || targetNum < 0) {
      setFormError('Mobilisation Target must be a valid positive number.');
      return;
    }

    const primaryPhase = formPhases.length > 0 ? formPhases[0] : undefined;
    const primaryCycle = formCycles.length > 0 ? formCycles[0] : undefined;

    // Check duplicate configuration before saving to database:
    // Programme + State + Year + Phase + Cycle
    const duplicateCheck = dataStore.checkProgrammeConfigurationDuplicate({
      name: trimmedName,
      state: trimmedState,
      year: trimmedYear,
      phase: primaryPhase,
      cycle: primaryCycle,
      phases: formPhases,
      cycles: formCycles,
      excludeProjectId: editingProject?.id,
    });

    if (duplicateCheck.isDuplicate) {
      setFormError(DUPLICATE_PROGRAMME_CONFIG_ERROR);
      return;
    }

    try {
      if (editingProject) {
        dataStore.updateProject(
          editingProject.id,
          {
            name: trimmedName,
            state: trimmedState,
            year: trimmedYear,
            phase: primaryPhase,
            cycle: primaryCycle,
            phases: formPhases,
            cycles: formCycles,
            status: formStatus,
            target: targetNum,
            startDate: formStartDate || undefined,
            endDate: formEndDate || undefined,
          },
          currentUser.name
        );
        showToast(`Successfully updated programme "${trimmedName}" (${trimmedState} - ${trimmedYear}).`);
      } else {
        dataStore.addProject(
          {
            name: trimmedName,
            state: trimmedState,
            year: trimmedYear,
            phase: primaryPhase,
            cycle: primaryCycle,
            phases: formPhases,
            cycles: formCycles,
            status: formStatus,
            target: targetNum,
            startDate: formStartDate || undefined,
            endDate: formEndDate || undefined,
          },
          currentUser.name
        );
        showToast(`Successfully added new programme "${trimmedName}" for ${trimmedState} (${trimmedYear}).`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save programme.');
    }
  };

  const handleConfirmDelete = () => {
    if (!projectToDelete) return;
    try {
      const name = projectToDelete.name;
      const stateName = projectToDelete.state || 'All States';
      dataStore.deleteProject(projectToDelete.id, currentUser.name);
      showToast(`Programme "${name}" (${stateName}) has been removed.`);
      setProjectToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete programme');
      setProjectToDelete(null);
    }
  };

  // Guard: Admin-only view
  if (currentUser.role !== 'admin') {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          The Programme Master is maintained exclusively by Amit Sinha (Admin). Changes here update programmes, batches, and candidate filters across the entire system.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-700 shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900">Programme Master</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                Admin Master
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage Central & State skill training schemes, state-wise quotas, and intake targets.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-98 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Programme</span>
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Records</div>
            <div className="text-xl font-black text-slate-900 leading-tight mt-0.5">{allProjects.length}</div>
            <div className="text-[10px] text-slate-400">State-wise allocations</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Programmes</div>
            <div className="text-xl font-black text-emerald-700 leading-tight mt-0.5">{activeCount}</div>
            <div className="text-[10px] text-emerald-600 font-medium">Currently taking admissions</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Intake Target</div>
            <div className="text-xl font-black text-blue-700 leading-tight mt-0.5">{totalTarget}</div>
            <div className="text-[10px] text-slate-400">Combined candidate capacity</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mobilised Candidates</div>
            <div className="text-xl font-black text-amber-700 leading-tight mt-0.5">{totalMobilised}</div>
            <div className="text-[10px] text-slate-400">
              {totalTarget > 0 ? `${Math.round((totalMobilised / totalTarget) * 100)}% overall target` : '0% target'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['All', 'Active', 'Upcoming', 'Completed'] as const).map((status) => {
            const count = status === 'All' ? allProjects.length : allProjects.filter((p) => p.status === status).length;
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{status}</span>
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* State Filter, Year Filter & Search Input */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500">State:</span>
            <select
              value={selectedStateFilter}
              onChange={(e) => setSelectedStateFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="All">All States</option>
              {AVAILABLE_STATES.filter((s) => s !== 'All States').map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500">Year:</span>
            <select
              value={selectedYearFilter}
              onChange={(e) => setSelectedYearFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="All">All Years</option>
              {STANDARD_YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search programme, state, year..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Programmes List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No Programmes Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? `No programmes matching "${searchQuery}". Try a different keyword.`
                : 'No programmes configured under this status, state, or year filter.'}
            </p>
            {(searchQuery || selectedStateFilter !== 'All' || selectedYearFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStateFilter('All');
                  setSelectedYearFilter('All');
                }}
                className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Programme Name</th>
                  <th className="py-3 px-4">State</th>
                  <th className="py-3 px-4">Year</th>
                  <th className="py-3 px-4">Phases & Cycles</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Target</th>
                  <th className="py-3 px-4">Enrolment & Progress</th>
                  <th className="py-3 px-4">Timeline</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((proj) => {
                  const stats = programmeRecordStats[proj.id] || { total: 0, confirmed: 0, reported: 0 };
                  const percent = proj.target > 0 ? Math.round((stats.total / proj.target) * 100) : 0;
                  const displayState = proj.state || 'All States';
                  const displayYear = proj.year || '2026-27';
                  const phases = Array.isArray(proj.phases) ? proj.phases : [];
                  const cycles = Array.isArray(proj.cycles) ? proj.cycles : [];

                  return (
                    <tr key={proj.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Programme Name Only */}
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-900 text-sm">{proj.name}</span>
                        </div>
                      </td>

                      {/* State Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            displayState === 'All States'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}
                        >
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{displayState}</span>
                        </span>
                      </td>

                      {/* Year Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Calendar className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{displayYear}</span>
                        </span>
                      </td>

                      {/* Phases & Cycles */}
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-400 mr-0.5">Phase:</span>
                            {(proj.phase ? [proj.phase] : (phases.length > 0 ? phases : [])).map((ph) => (
                              <span
                                key={ph}
                                className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold"
                              >
                                {ph}
                              </span>
                            ))}
                            {!proj.phase && phases.length === 0 && (
                              <span className="text-[10px] text-slate-400 italic">None</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-400 mr-0.5">Cycle:</span>
                            {(proj.cycle ? [proj.cycle] : (cycles.length > 0 ? cycles : [])).map((cy) => (
                              <span
                                key={cy}
                                className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold"
                              >
                                {cy}
                              </span>
                            ))}
                            {!proj.cycle && cycles.length === 0 && (
                              <span className="text-[10px] text-slate-400 italic">None</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            proj.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : proj.status === 'Upcoming'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              proj.status === 'Active'
                                ? 'bg-emerald-600 animate-pulse'
                                : proj.status === 'Upcoming'
                                ? 'bg-blue-600'
                                : 'bg-slate-500'
                            }`}
                          />
                          {proj.status}
                        </span>
                      </td>

                      {/* Mobilisation Target */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-black text-slate-900 text-sm">{proj.target}</div>
                        <span className="text-[10px] text-slate-400">candidates</span>
                      </td>

                      {/* Enrolment & Progress (Specific to this State/Year Record) */}
                      <td className="py-3.5 px-4 min-w-[170px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-800">
                              {stats.total} <span className="font-normal text-slate-500">enrolled</span>
                            </span>
                            <span className="font-extrabold text-indigo-700">{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                percent >= 100
                                  ? 'bg-emerald-500'
                                  : percent >= 50
                                  ? 'bg-indigo-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{stats.confirmed} Confirmed</span>
                            <span>•</span>
                            <span>{stats.reported} Reported</span>
                          </div>
                        </div>
                      </td>

                      {/* Timeline */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{proj.startDate || 'N/A'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 pl-5">
                          to {proj.endDate || 'Ongoing'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(proj)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Programme"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProjectToDelete(proj)}
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Programme"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Programme Modal (Wizard) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingProject ? 'Edit Programme' : 'Add New Programme'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configure programme name, state, year, phases, cycles, target, and timelines
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="p-6 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {!formError && configurationDuplicateWarning && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-center gap-2 text-xs font-bold text-rose-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{configurationDuplicateWarning}</span>
                </div>
              )}

              {/* Unique Configuration Indicator */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Configuration Key (Unique Combination)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Programme + State + Year + Phase + Cycle
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold">
                    {formName.trim() || 'Programme'}
                  </span>
                  <span className="text-slate-400 font-bold">+</span>
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded">{formState}</span>
                  <span className="text-slate-400 font-bold">+</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">{formYear}</span>
                  <span className="text-slate-400 font-bold">+</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded">{formPhases[0] || 'Phase 1'}</span>
                  <span className="text-slate-400 font-bold">+</span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded">{formCycles[0] || 'Cycle 1'}</span>
                </div>
              </div>

              {/* 1. Programme / Project Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Programme / Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DDU-GKY 2.0, CSR - Raddison, CSR - Oberoi, RTD"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              {/* 2. State & 3. Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    State <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    {AVAILABLE_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Configured separately for each state.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    {STANDARD_YEAR_OPTIONS.map((yearOption) => (
                      <option key={yearOption} value={yearOption}>
                        {yearOption}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Financial / Implementation year.
                  </p>
                </div>
              </div>

              {/* 4. Phase(s) (Allow multiple Phases to be configured) */}
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Phase(s) Configuration
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {formPhases.length} {formPhases.length === 1 ? 'phase' : 'phases'} configured
                  </span>
                </div>

                {/* Chips of added phases */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[30px]">
                  {formPhases.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No phases added yet (optional for CSR/RTD).</span>
                  ) : (
                    formPhases.map((phase, idx) => (
                      <span
                        key={`${phase}-${idx}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold shadow-2xs"
                      >
                        <span>{phase}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePhase(idx)}
                          className="text-blue-500 hover:text-rose-600 hover:bg-blue-100 rounded p-0.5 transition-colors cursor-pointer"
                          title={`Remove ${phase}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Input to add custom phase */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Type phase name (e.g. Phase 4) and click Add"
                    value={phaseInput}
                    onChange={(e) => setPhaseInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPhase();
                      }
                    }}
                    className="flex-1 text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddPhase()}
                    disabled={!phaseInput.trim()}
                    className="px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    + Add Phase
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Quick add:</span>
                  {['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'].map((quickPhase) => {
                    const alreadyAdded = formPhases.includes(quickPhase);
                    return (
                      <button
                        key={quickPhase}
                        type="button"
                        onClick={() => handleAddPhase(quickPhase)}
                        disabled={alreadyAdded}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer font-medium ${
                          alreadyAdded
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                        }`}
                      >
                        + {quickPhase}
                      </button>
                    );
                  })}
                  {formPhases.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormPhases([])}
                      className="text-[10px] px-2 py-0.5 text-rose-600 hover:underline font-semibold ml-auto cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* 5. Cycle(s) (Allow multiple Cycles to be configured) */}
              <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Cycle(s) Configuration
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {formCycles.length} {formCycles.length === 1 ? 'cycle' : 'cycles'} configured
                  </span>
                </div>

                {/* Chips of added cycles */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[30px]">
                  {formCycles.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">No cycles added yet (optional for CSR/RTD).</span>
                  ) : (
                    formCycles.map((cycle, idx) => (
                      <span
                        key={`${cycle}-${idx}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-lg text-xs font-bold shadow-2xs"
                      >
                        <span>{cycle}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCycle(idx)}
                          className="text-purple-500 hover:text-rose-600 hover:bg-purple-100 rounded p-0.5 transition-colors cursor-pointer"
                          title={`Remove ${cycle}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Input to add custom cycle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Type cycle name (e.g. Cycle 4) and click Add"
                    value={cycleInput}
                    onChange={(e) => setCycleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCycle();
                      }
                    }}
                    className="flex-1 text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCycle()}
                    disabled={!cycleInput.trim()}
                    className="px-3 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    + Add Cycle
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-semibold">Quick add:</span>
                  {['Cycle 1', 'Cycle 2', 'Cycle 3', 'Cycle 4'].map((quickCycle) => {
                    const alreadyAdded = formCycles.includes(quickCycle);
                    return (
                      <button
                        key={quickCycle}
                        type="button"
                        onClick={() => handleAddCycle(quickCycle)}
                        disabled={alreadyAdded}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer font-medium ${
                          alreadyAdded
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                        }`}
                      >
                        + {quickCycle}
                      </button>
                    );
                  })}
                  {formCycles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormCycles([])}
                      className="text-[10px] px-2 py-0.5 text-rose-600 hover:underline font-semibold ml-auto cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* 6. Status & 7. Mobilisation Target */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Upcoming">Upcoming</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobilisation Target (Candidates) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formTarget}
                    onChange={(e) => setFormTarget(Number(e.target.value))}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* 8. Start Date & 9. End Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {editingProject ? 'Save Changes' : 'Create Programme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (In-App, No window.confirm) */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Delete Programme</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900 font-bold">{projectToDelete.name}</strong>{' '}
                for <span className="font-semibold text-indigo-700">({projectToDelete.state || 'All States'})</span>?
              </p>
            </div>

            {/* Candidate Impact Info for this state-specific programme */}
            {(() => {
              const enrolled = programmeRecordStats[projectToDelete.id]?.total || 0;
              return enrolled > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Candidate Records Attached</span>
                  </div>
                  <p>
                    There are currently <strong>{enrolled} candidate(s)</strong> tagged under {projectToDelete.name} in {projectToDelete.state || 'All States'}. Deleting this programme record removes it from filters and quotas, but candidate profiles will remain intact.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                  No candidates are currently allocated to this specific state programme record. It is safe to remove.
                </div>
              );
            })()}

            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => setProjectToDelete(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Yes, Delete Programme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
