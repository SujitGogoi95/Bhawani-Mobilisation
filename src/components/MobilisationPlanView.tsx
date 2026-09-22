import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarRange,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  FileText,
  IndianRupee,
  MapPin,
  Building,
  UserCheck,
  Calendar,
  AlertCircle,
  Edit3,
  Trash2,
  Eye,
  TrendingUp,
  Download,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  Info,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import {
  MobilisationPlan,
  MobilisationPlanStatus,
  PlanBudget,
  User as UserType,
  ActivityType,
} from '../types';
import { getAllStates, getDistrictsForState, getBlocksForDistrict, getStateForDistrict } from '../utils/locationData';
import { getUserAssignedState } from '../utils/userState';

interface MobilisationPlanViewProps {
  currentUser: UserType;
  onNavigateToActivities?: () => void;
}

export const MobilisationPlanView: React.FC<MobilisationPlanViewProps> = ({
  currentUser,
  onNavigateToActivities,
}) => {
  const userAssignedState = useMemo(() => getUserAssignedState(currentUser), [currentUser]);

  // Navigation & filter states
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'pending' | 'approved' | 'drafts'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [selectedProgrammeFilter, setSelectedProgrammeFilter] = useState<string>('All');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('All');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MobilisationPlan | null>(null);
  const [reviewingPlan, setReviewingPlan] = useState<MobilisationPlan | null>(null);
  const [viewingPlanDetails, setViewingPlanDetails] = useState<MobilisationPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<MobilisationPlan | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states for Create/Edit
  const [formProjectId, setFormProjectId] = useState('');
  const [formProgramme, setFormProgramme] = useState('DDU-GKY 2.0');
  const [formState, setFormState] = useState(
    userAssignedState ||
      (currentUser.state && currentUser.state !== 'All'
        ? currentUser.state
        : getStateForDistrict(currentUser.district || 'Kohima') || 'Nagaland')
  );
  const [formDistrict, setFormDistrict] = useState(currentUser.district || 'Kohima');
  const [formLocation, setFormLocation] = useState('');
  const [formMobiliserId, setFormMobiliserId] = useState(currentUser.id);
  const [formMobiliserName, setFormMobiliserName] = useState(currentUser.name);
  const [formActivityType, setFormActivityType] = useState<ActivityType>('Community Meeting');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Budget states (Planned)
  const [formTravelling, setFormTravelling] = useState<number | string>(1500);
  const [formLodging, setFormLodging] = useState<number | string>(1000);
  const [formFooding, setFormFooding] = useState<number | string>(800);
  const [formNotes, setFormNotes] = useState('');

  // Admin Review Form State
  const [reviewTravelling, setReviewTravelling] = useState<number | string>(0);
  const [reviewLodging, setReviewLodging] = useState<number | string>(0);
  const [reviewFooding, setReviewFooding] = useState<number | string>(0);
  const [reviewRemarks, setReviewRemarks] = useState('');

  // Data subscriptions & masters
  const [plans, setPlans] = useState<MobilisationPlan[]>([]);
  const availableStates = useMemo(() => getAllStates(), []);

  // Filter projects for the table/grid filter bar
  const filterProjects = useMemo(() => {
    return dataStore.getProjects(selectedStateFilter !== 'All' ? selectedStateFilter : undefined, currentUser);
  }, [selectedStateFilter, currentUser]);

  // Effective state for active form calculations
  const activeFormState = userAssignedState || formState;

  // Available projects strictly bound to state context
  const formAvailableProjects = useMemo(() => {
    return dataStore.getProjects(activeFormState, currentUser);
  }, [activeFormState, currentUser]);

  // Available individual field mobilisers strictly bound to state context
  const formAvailableMobilisers = useMemo(() => {
    return dataStore.getFieldMobilisers(activeFormState, false, currentUser);
  }, [activeFormState, currentUser]);

  const refreshPlans = () => {
    setPlans(dataStore.getMobilisationPlans(currentUser));
  };

  useEffect(() => {
    refreshPlans();
    const unsub = dataStore.subscribe(() => {
      refreshPlans();
    });
    return () => unsub();
  }, [currentUser]);

  // Handle cascading districts for form based on active state
  const availableFormDistricts = useMemo(() => {
    const dists = getDistrictsForState(activeFormState);
    if (dists.length > 0) return dists;
    return dataStore
      .getDistricts()
      .filter((d) => !d.stateName || d.stateName.toLowerCase() === activeFormState.toLowerCase())
      .map((d) => d.name);
  }, [activeFormState]);

  const handleFormStateChange = (newState: string) => {
    setFormState(newState);
    const dists = getDistrictsForState(newState);
    if (dists.length > 0) {
      setFormDistrict(dists[0]);
    } else {
      setFormDistrict('');
    }

    // Update available projects for the newly selected state
    const newProjs = dataStore.getProjects(newState, currentUser);
    if (newProjs.length > 0) {
      setFormProjectId(newProjs[0].id);
      setFormProgramme(newProjs[0].name);
    }

    // Update available mobilisers for the newly selected state
    const newMobs = dataStore.getFieldMobilisers(newState, false, currentUser);
    if (newMobs.length > 0) {
      setFormMobiliserId(newMobs[0].id);
      setFormMobiliserName(newMobs[0].name);
      if (newMobs[0].district) {
        setFormDistrict(newMobs[0].district);
      }
    }
  };

  const handleFormMobiliserChange = (mobId: string) => {
    setFormMobiliserId(mobId);
    const mob = formAvailableMobilisers.find((m) => m.id === mobId);
    if (mob) {
      setFormMobiliserName(mob.name);
      if (mob.district) {
        setFormDistrict(mob.district);
      }
    }
  };

  // Auto-calculate planned total
  const formTotalPlanned = useMemo(() => {
    const t = Math.max(0, Number(formTravelling) || 0);
    const l = Math.max(0, Number(formLodging) || 0);
    const f = Math.max(0, Number(formFooding) || 0);
    return t + l + f;
  }, [formTravelling, formLodging, formFooding]);

  // Auto-calculate review approved total
  const reviewTotalApproved = useMemo(() => {
    const t = Math.max(0, Number(reviewTravelling) || 0);
    const l = Math.max(0, Number(reviewLodging) || 0);
    const f = Math.max(0, Number(reviewFooding) || 0);
    return t + l + f;
  }, [reviewTravelling, reviewLodging, reviewFooding]);

  // Open Create Modal with fresh state
  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setFormError(null);

    const targetState =
      userAssignedState ||
      (currentUser.state && currentUser.state !== 'All' ? currentUser.state : 'Nagaland');
    setFormState(targetState);

    // Filter projects for the target state
    const projs = dataStore.getProjects(targetState, currentUser);
    const defaultProj = projs[0];
    setFormProjectId(defaultProj?.id || '');
    setFormProgramme(defaultProj?.name || 'DDU-GKY 2.0');

    // Filter mobilisers for the target state
    const mobs = dataStore.getFieldMobilisers(targetState, false, currentUser);
    const defaultMob = mobs[0];
    if (defaultMob) {
      setFormMobiliserId(defaultMob.id);
      setFormMobiliserName(defaultMob.name);
      setFormDistrict(defaultMob.district || getDistrictsForState(targetState)[0] || 'Kohima');
    } else {
      setFormMobiliserId(currentUser.id);
      setFormMobiliserName(currentUser.name);
      setFormDistrict(getDistrictsForState(targetState)[0] || 'Kohima');
    }

    setFormLocation('');
    setFormActivityType('Community Meeting');
    const today = new Date().toISOString().split('T')[0];
    setFormStartDate(today);
    setFormEndDate(today);
    setFormTravelling(1500);
    setFormLodging(1000);
    setFormFooding(800);
    setFormNotes('');
    setShowCreateModal(true);
  };

  // Open Edit Modal for Draft or Sent Back plan
  const handleOpenEditModal = (plan: MobilisationPlan) => {
    setEditingPlan(plan);
    setFormError(null);
    setFormState(plan.state);
    setFormDistrict(plan.district);
    setFormLocation(plan.location || '');
    setFormMobiliserId(plan.mobiliserId);
    setFormMobiliserName(plan.mobiliserName);
    setFormActivityType(plan.activityType);
    setFormStartDate(plan.startDate);
    setFormEndDate(plan.endDate);
    setFormTravelling(plan.plannedBudget.travelling);
    setFormLodging(plan.plannedBudget.lodging);
    setFormFooding(plan.plannedBudget.fooding);
    setFormNotes(plan.notes || '');

    const projs = dataStore.getProjects(plan.state, currentUser);
    const matchedProj = projs.find(
      (p) => p.id === plan.projectId || p.name.toLowerCase() === plan.programme.toLowerCase()
    );
    setFormProjectId(matchedProj?.id || plan.projectId || projs[0]?.id || '');
    setFormProgramme(matchedProj?.name || plan.programme || 'DDU-GKY 2.0');

    setShowCreateModal(true);
  };

  // Save Plan as Draft or Submit
  const handleSavePlan = (targetStatus: 'Draft' | 'Submitted') => {
    setFormError(null);
    if (!formStartDate || !formEndDate) {
      setFormError('Please select both Start Date and End Date for the mobilisation period.');
      return;
    }
    if (formEndDate < formStartDate) {
      setFormError('Activity End Date cannot be earlier than Activity Start Date.');
      return;
    }

    const plannedBudget: PlanBudget = {
      travelling: Math.max(0, Number(formTravelling) || 0),
      lodging: Math.max(0, Number(formLodging) || 0),
      fooding: Math.max(0, Number(formFooding) || 0),
      total: formTotalPlanned,
    };

    const targetState = userAssignedState || formState;
    const selectedMob = formAvailableMobilisers.find((m) => m.id === formMobiliserId);
    const finalMobName = selectedMob ? selectedMob.name : formMobiliserName;
    const selectedProj = formAvailableProjects.find(
      (p) => p.id === formProjectId || p.name === formProgramme
    );
    const finalProg = selectedProj ? selectedProj.name : formProgramme;
    const finalProjId = selectedProj ? selectedProj.id : formProjectId;

    if (editingPlan) {
      dataStore.updateMobilisationPlan(editingPlan.id, {
        programme: finalProg,
        projectId: finalProjId,
        state: targetState,
        district: formDistrict,
        block: formLocation.trim() || formDistrict,
        location: formLocation.trim() || formDistrict,
        mobiliserId: formMobiliserId,
        mobiliserName: finalMobName,
        activityType: formActivityType,
        startDate: formStartDate,
        endDate: formEndDate,
        plannedBudget,
        notes: formNotes.trim(),
        status: targetStatus,
      });
    } else {
      dataStore.addMobilisationPlan({
        programme: finalProg,
        projectId: finalProjId,
        state: targetState,
        district: formDistrict,
        block: formLocation.trim() || formDistrict,
        location: formLocation.trim() || formDistrict,
        mobiliserId: formMobiliserId,
        mobiliserName: finalMobName,
        activityType: formActivityType,
        startDate: formStartDate,
        endDate: formEndDate,
        plannedBudget,
        notes: formNotes.trim(),
        status: targetStatus,
      });
    }

    setShowCreateModal(false);
    setEditingPlan(null);
  };

  // Open Admin Review Modal
  const handleOpenReviewModal = (plan: MobilisationPlan) => {
    setReviewingPlan(plan);
    // Prefill approved budget with existing approvedBudget or plannedBudget
    const baseBudget = plan.approvedBudget || plan.plannedBudget;
    setReviewTravelling(baseBudget.travelling);
    setReviewLodging(baseBudget.lodging);
    setReviewFooding(baseBudget.fooding);
    setReviewRemarks(plan.reviewRemarks || '');
  };

  // Execute Admin Review (Approve, Reject, or Send Back)
  const handleExecuteReview = (action: 'Approve' | 'Reject' | 'Send Back') => {
    if (!reviewingPlan) return;

    dataStore.reviewMobilisationPlan(reviewingPlan.id, action, {
      approvedBudget: {
        travelling: Math.max(0, Number(reviewTravelling) || 0),
        lodging: Math.max(0, Number(reviewLodging) || 0),
        fooding: Math.max(0, Number(reviewFooding) || 0),
        total: reviewTotalApproved,
      },
      remarks: reviewRemarks.trim(),
    });

    setReviewingPlan(null);
  };

  // Delete Plan trigger (opens confirmation modal, avoids blocked window.confirm)
  const handleDeletePlan = (plan: MobilisationPlan) => {
    setPlanToDelete(plan);
  };

  // Confirm and execute plan deletion
  const confirmExecuteDelete = () => {
    if (!planToDelete) return;
    const targetId = planToDelete.id;
    dataStore.deleteMobilisationPlan(targetId, currentUser.name);
    refreshPlans();

    if (viewingPlanDetails?.id === targetId) {
      setViewingPlanDetails(null);
    }
    if (editingPlan?.id === targetId) {
      setEditingPlan(null);
      setShowCreateModal(false);
    }
    setPlanToDelete(null);
  };

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      // Sub-tab filter
      if (activeSubTab === 'pending' && p.status !== 'Submitted') return false;
      if (activeSubTab === 'approved' && p.status !== 'Approved') return false;
      if (activeSubTab === 'drafts' && p.status !== 'Draft' && p.status !== 'Sent Back') return false;

      // Status dropdown filter
      if (selectedStatusFilter !== 'All' && p.status !== selectedStatusFilter) {
        return false;
      }

      // Programme filter
      if (selectedProgrammeFilter !== 'All' && p.programme !== selectedProgrammeFilter) {
        return false;
      }

      // State filter
      if (selectedStateFilter !== 'All' && p.state !== selectedStateFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPlanId = p.planId.toLowerCase().includes(q);
        const matchesMob = p.mobiliserName.toLowerCase().includes(q);
        const matchesDist = p.district.toLowerCase().includes(q);
        const matchesProg = p.programme.toLowerCase().includes(q);
        const matchesType = p.activityType.toLowerCase().includes(q);
        const matchesLoc = (p.location || '').toLowerCase().includes(q);
        if (!matchesPlanId && !matchesMob && !matchesDist && !matchesProg && !matchesType && !matchesLoc) {
          return false;
        }
      }

      return true;
    });
  }, [
    plans,
    activeSubTab,
    selectedStatusFilter,
    selectedProgrammeFilter,
    selectedStateFilter,
    searchQuery,
  ]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalPlans = plans.length;
    const approvedPlans = plans.filter((p) => p.status === 'Approved');
    const pendingPlans = plans.filter((p) => p.status === 'Submitted');
    const draftPlans = plans.filter((p) => p.status === 'Draft' || p.status === 'Sent Back');

    const totalPlannedBudget = plans.reduce((acc, p) => acc + (p.plannedBudget?.total || 0), 0);
    const totalApprovedBudget = approvedPlans.reduce(
      (acc, p) => acc + (p.approvedBudget?.total || p.plannedBudget?.total || 0),
      0
    );

    // Calculate actual expenditure across all plans
    let totalActualExpenditure = 0;
    approvedPlans.forEach((p) => {
      const actuals = dataStore.getPlanActuals(p.id);
      totalActualExpenditure += actuals.actualTotal;
    });

    const utilisationPercent =
      totalApprovedBudget > 0 ? (totalActualExpenditure / totalApprovedBudget) * 100 : 0;

    return {
      totalPlans,
      approvedCount: approvedPlans.length,
      pendingCount: pendingPlans.length,
      draftCount: draftPlans.length,
      totalPlannedBudget,
      totalApprovedBudget,
      totalActualExpenditure,
      utilisationPercent,
    };
  }, [plans]);

  const activityTypeOptions: ActivityType[] = [
    'Community Meeting',
    'School Visit',
    'College Visit',
    'Village Visit',
    'Stakeholder Meeting',
    'Seminar',
    'Canvassing / Door-to-Door',
    'Job Mela / Placement Drive',
    'Other',
  ];

  const getStatusBadge = (status: MobilisationPlanStatus) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Approved
          </span>
        );
      case 'Submitted':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
            Pending Approval
          </span>
        );
      case 'Sent Back':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            <RotateCcw className="w-3 h-3 text-indigo-600" />
            Sent Back for Correction
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejected
          </span>
        );
      case 'Draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <FileText className="w-3 h-3 text-slate-500" />
            Draft
          </span>
        );
    }
  };

  const isAdminOrManager = currentUser.role === 'admin' || currentUser.role === 'manager';

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Mobilisation Plans</h1>
              <p className="text-xs text-slate-500">
                Plan field schedules, submit travelling/lodging/fooding budgets, and secure admin approval
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="create-mobilisation-plan-btn"
            onClick={handleOpenCreateModal}
            className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Mobilisation Plan</span>
          </button>
        </div>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Total Plans</span>
            <CalendarRange className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.totalPlans}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="text-emerald-700 font-bold">{metrics.approvedCount} approved</span>
            <span>•</span>
            <span className="text-amber-700 font-bold">{metrics.pendingCount} pending</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Approved Budget</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">
            ₹{metrics.totalApprovedBudget.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Planned: ₹{metrics.totalPlannedBudget.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Actual Field Spend</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            ₹{metrics.totalActualExpenditure.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500">
            Utilisation: <span className="font-bold text-slate-800">{metrics.utilisationPercent.toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Pending Approvals</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{metrics.pendingCount}</div>
          <div className="text-[11px] text-slate-500">
            {isAdminOrManager ? 'Requires your administrative review' : 'Awaiting admin decision'}
          </div>
        </div>
      </div>

      {/* Workflow Explainer Pill */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-slate-50 to-emerald-50/70 p-3.5 rounded-xl border border-indigo-100 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-semibold text-slate-800">
            Mobilisation Workflow:
          </span>
          <span className="text-slate-600 hidden md:inline">
            Mobiliser creates plan → Admin approves → Mobiliser conducts activities → Field Activity automatically determines Planned vs Unplanned.
          </span>
        </div>
        {onNavigateToActivities && (
          <button
            onClick={onNavigateToActivities}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer shrink-0"
          >
            <span>Go to Field Activities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        {/* Sub tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
              activeSubTab === 'all'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Plans ({plans.length})
          </button>
          <button
            onClick={() => setActiveSubTab('pending')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'pending'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Pending Review</span>
            {metrics.pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 text-white font-bold">
                {metrics.pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('approved')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
              activeSubTab === 'approved'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Approved ({metrics.approvedCount})
          </button>
          <button
            onClick={() => setActiveSubTab('drafts')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
              activeSubTab === 'drafts'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Drafts & Corrections ({metrics.draftCount})
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search plan ID, mobiliser, district..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted (Pending)</option>
              <option value="Approved">Approved</option>
              <option value="Sent Back">Sent Back</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <select
              value={selectedProgrammeFilter}
              onChange={(e) => setSelectedProgrammeFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="All">All Programmes</option>
              {filterProjects.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStateFilter}
              onChange={(e) => setSelectedStateFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="All">All States</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Plans List / Grid */}
      {filteredPlans.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
            <CalendarRange className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Mobilisation Plans Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery || selectedStatusFilter !== 'All'
              ? 'No plans match the selected filters or search keyword. Try clearing some filters.'
              : 'Create a planned mobilisation period with Travelling, Lodging, and Fooding budgets for admin approval.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            + Create First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPlans.map((plan) => {
            const actuals = dataStore.getPlanActuals(plan.id);
            const approvedBudget = plan.approvedBudget || plan.plannedBudget;
            const variance = approvedBudget.total - actuals.actualTotal;
            const utilisation =
              approvedBudget.total > 0 ? (actuals.actualTotal / approvedBudget.total) * 100 : 0;
            const isOwnerOrSameState =
              currentUser.id === plan.mobiliserId ||
              currentUser.id === plan.createdBy ||
              (userAssignedState && plan.state && userAssignedState.toLowerCase() === plan.state.toLowerCase());
            const canEdit =
              currentUser.role === 'admin' ||
              currentUser.role === 'manager' ||
              (isOwnerOrSameState &&
                (plan.status === 'Draft' || plan.status === 'Sent Back'));
            const canDelete =
              currentUser.role === 'admin' ||
              currentUser.role === 'manager' ||
              (isOwnerOrSameState &&
                (plan.status === 'Draft' || plan.status === 'Sent Back'));
            const canReview = isAdminOrManager && plan.status === 'Submitted';

            return (
              <div
                key={plan.id}
                id={`plan-card-${plan.planId}`}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Top Bar: Plan ID, Status & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {plan.planId}
                        </span>
                        {getStatusBadge(plan.status)}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {plan.programme} • {plan.activityType}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {plan.location ? `${plan.location}, ` : ''}
                          {plan.district}, {plan.state}
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                        Mobiliser
                      </span>
                      <span className="text-xs font-bold text-slate-800">{plan.mobiliserName}</span>
                    </div>
                  </div>

                  {/* Mobilisation Planned Period */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                          Planned Period
                        </span>
                        <span className="font-bold text-slate-800">
                          {plan.startDate} <span className="text-slate-400">to</span> {plan.endDate}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                      {actuals.plannedActivitiesCount} logged{' '}
                      {actuals.plannedActivitiesCount === 1 ? 'activity' : 'activities'}
                    </span>
                  </div>

                  {/* Budget Comparison Matrix */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700">Budget Breakdown</span>
                      {plan.status === 'Approved' ? (
                        <span className="text-emerald-700 font-bold">
                          Approved: ₹{approvedBudget.total.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-semibold">
                          Planned: ₹{plan.plannedBudget.total.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Travelling</span>
                        <span className="font-bold text-slate-800">
                          ₹
                          {plan.status === 'Approved' && plan.approvedBudget
                            ? plan.approvedBudget.travelling.toLocaleString()
                            : plan.plannedBudget.travelling.toLocaleString()}
                        </span>
                        {actuals.actualTravelling > 0 && (
                          <span className="text-[9px] text-slate-500 block mt-0.5">
                            Act: ₹{actuals.actualTravelling.toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Lodging</span>
                        <span className="font-bold text-slate-800">
                          ₹
                          {plan.status === 'Approved' && plan.approvedBudget
                            ? plan.approvedBudget.lodging.toLocaleString()
                            : plan.plannedBudget.lodging.toLocaleString()}
                        </span>
                        {actuals.actualLodging > 0 && (
                          <span className="text-[9px] text-slate-500 block mt-0.5">
                            Act: ₹{actuals.actualLodging.toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Fooding</span>
                        <span className="font-bold text-slate-800">
                          ₹
                          {plan.status === 'Approved' && plan.approvedBudget
                            ? plan.approvedBudget.fooding.toLocaleString()
                            : plan.plannedBudget.fooding.toLocaleString()}
                        </span>
                        {actuals.actualFooding > 0 && (
                          <span className="text-[9px] text-slate-500 block mt-0.5">
                            Act: ₹{actuals.actualFooding.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar for Approved plans */}
                    {plan.status === 'Approved' && approvedBudget.total > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">
                            Spent: ₹{actuals.actualTotal.toLocaleString()} of ₹
                            {approvedBudget.total.toLocaleString()}
                          </span>
                          <span
                            className={`font-bold ${
                              actuals.actualTotal > approvedBudget.total
                                ? 'text-rose-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {utilisation.toFixed(1)}% Utilised
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              actuals.actualTotal > approvedBudget.total
                                ? 'bg-rose-500'
                                : utilisation > 80
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, utilisation)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reviewer remarks if any */}
                  {plan.reviewRemarks && (
                    <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-0.5">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">
                        Admin Note ({plan.reviewedBy || 'Admin'}):
                      </span>
                      <p className="italic text-[11px]">"{plan.reviewRemarks}"</p>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewingPlanDetails(plan)}
                      className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Details</span>
                    </button>

                    {canEdit && (
                      <button
                        onClick={() => handleOpenEditModal(plan)}
                        className="px-2.5 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        id={`delete-plan-${plan.planId}`}
                        onClick={() => handleDeletePlan(plan)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                        title="Delete Plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div>
                    {canReview ? (
                      <button
                        onClick={() => handleOpenReviewModal(plan)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Review & Approve</span>
                      </button>
                    ) : plan.status === 'Draft' ? (
                      <button
                        onClick={() => {
                          dataStore.updateMobilisationPlan(plan.id, { status: 'Submitted' });
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                      >
                        <span>Submit for Approval</span>
                      </button>
                    ) : plan.status === 'Approved' && onNavigateToActivities ? (
                      <button
                        onClick={onNavigateToActivities}
                        className="px-2.5 py-1 text-emerald-700 hover:bg-emerald-50 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Log Field Activity</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MOBILISATION PLAN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in fade-in my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingPlan ? 'Edit Mobilisation Plan' : 'Create Mobilisation Plan'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Define the mobilisation period, target area, and planned budget breakdown
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingPlan(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message banner */}
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Programme * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Programme *</label>
                <select
                  value={formProjectId || formAvailableProjects.find((p) => p.name === formProgramme)?.id || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setFormProjectId(selectedId);
                    const selectedProj = formAvailableProjects.find((p) => p.id === selectedId);
                    if (selectedProj) {
                      setFormProgramme(selectedProj.name);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-700 cursor-pointer"
                >
                  {formAvailableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.state || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mobiliser * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobiliser *</label>
                <select
                  value={formMobiliserId}
                  onChange={(e) => handleFormMobiliserChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-700 cursor-pointer"
                >
                  {formAvailableMobilisers.map((m, idx) => (
                    <option key={`plan-mob-${m.id}-${idx}`} value={m.id}>
                      {m.name} ({m.district || m.state || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* State * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">State *</label>
                {isAdminOrManager && !userAssignedState ? (
                  <select
                    value={formState}
                    onChange={(e) => handleFormStateChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-700 cursor-pointer"
                  >
                    {availableStates.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={activeFormState}
                    className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg font-medium text-xs text-slate-600 cursor-not-allowed"
                  />
                )}
              </div>

              {/* District * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">District *</label>
                <select
                  value={formDistrict}
                  onChange={(e) => setFormDistrict(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-700"
                >
                  {availableFormDistricts.map((dName) => (
                    <option key={dName} value={dName}>
                      {dName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Block / Location */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Block / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Sadar, Jakhama, Town Hall"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Activity Type * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Activity Type *</label>
                <select
                  value={formActivityType}
                  onChange={(e) => setFormActivityType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-xs text-slate-700"
                >
                  {activityTypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Activity Start Date * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Activity Start Date *</label>
                <input
                  required
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Activity End Date * */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Activity End Date *</label>
                <input
                  required
                  type="date"
                  min={formStartDate}
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              * The Start Date and End Date define the planned mobilisation period during which field activities will automatically be recognized as Planned.
            </p>

            {/* Budget Breakdown Section */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Planned Budget Breakdown
                  </h4>
                  <p className="text-[11px] text-slate-500">Allow ₹0 for any category as needed.</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Total Planned Budget
                  </span>
                  <span className="text-base font-bold text-indigo-700">
                    ₹{formTotalPlanned.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Travelling */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Travelling (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formTravelling}
                    onChange={(e) => setFormTravelling(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                  />
                </div>

                {/* Lodging */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lodging (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formLodging}
                    onChange={(e) => setFormLodging(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                  />
                </div>

                {/* Fooding */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fooding (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={formFooding}
                    onChange={(e) => setFormFooding(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-xs">
                Objectives / Justification (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Details about expected villages, community outreach goals, or local coordination..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingPlan(null);
                    setFormError(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                {editingPlan && (currentUser.role === 'admin' || currentUser.role === 'manager' || (currentUser.id === editingPlan.mobiliserId && (editingPlan.status === 'Draft' || editingPlan.status === 'Sent Back'))) && (
                  <button
                    type="button"
                    id={`modal-delete-plan-${editingPlan.planId}`}
                    onClick={() => {
                      const p = editingPlan;
                      setShowCreateModal(false);
                      setEditingPlan(null);
                      handleDeletePlan(p);
                    }}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Plan</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSavePlan('Draft')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePlan('Submitted')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors"
                >
                  Submit for Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN APPROVAL MODAL */}
      {reviewingPlan && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in fade-in my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    {reviewingPlan.planId}
                  </span>
                  <span className="text-xs font-bold text-slate-800">Admin Review & Approval</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {reviewingPlan.programme} ({reviewingPlan.district}, {reviewingPlan.state})
                </h3>
              </div>
              <button
                onClick={() => setReviewingPlan(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plan Snapshot */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Mobiliser
                </span>
                <span className="font-bold text-slate-800">{reviewingPlan.mobiliserName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Activity Type
                </span>
                <span className="font-bold text-slate-800">{reviewingPlan.activityType}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Mobilisation Period
                </span>
                <span className="font-bold text-slate-800">
                  {reviewingPlan.startDate} to {reviewingPlan.endDate}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Total Planned Budget
                </span>
                <span className="font-bold text-indigo-700">
                  ₹{reviewingPlan.plannedBudget.total.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Admin Modification of Approved Budget */}
            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    Set Approved Budget (₹)
                  </h4>
                  <p className="text-[11px] text-emerald-700">
                    As Admin, you can approve the requested amounts or modify category ceilings.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-700 uppercase font-semibold block">
                    Total Approved
                  </span>
                  <span className="text-lg font-bold text-emerald-800">
                    ₹{reviewTotalApproved.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Travelling (₹)</label>
                    <span className="text-[10px] text-slate-400">
                      Req: ₹{reviewingPlan.plannedBudget.travelling}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={reviewTravelling}
                    onChange={(e) => setReviewTravelling(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Lodging (₹)</label>
                    <span className="text-[10px] text-slate-400">
                      Req: ₹{reviewingPlan.plannedBudget.lodging}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={reviewLodging}
                    onChange={(e) => setReviewLodging(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Fooding (₹)</label>
                    <span className="text-[10px] text-slate-400">
                      Req: ₹{reviewingPlan.plannedBudget.fooding}
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={reviewFooding}
                    onChange={(e) => setReviewFooding(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 text-xs">
                Admin Remarks / Instructions for Mobiliser
              </label>
              <textarea
                rows={2}
                placeholder="Add approval comments, travel sanction notes, or correction requirements..."
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            {/* 3 Actions: Approve, Reject, Send Back */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setReviewingPlan(null)}
                className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExecuteReview('Reject')}
                  className="flex-1 sm:flex-none px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Reject Plan
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteReview('Send Back')}
                  className="flex-1 sm:flex-none px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Send Back for Correction
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteReview('Approve')}
                  className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLAN DETAILS MODAL */}
      {viewingPlanDetails && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-in fade-in my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {viewingPlanDetails.planId}
                  </span>
                  {getStatusBadge(viewingPlanDetails.status)}
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {viewingPlanDetails.programme} • {viewingPlanDetails.activityType}
                </h3>
              </div>
              <button
                onClick={() => setViewingPlanDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Mobiliser
                </span>
                <span className="font-bold text-slate-800">{viewingPlanDetails.mobiliserName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Target District & State
                </span>
                <span className="font-bold text-slate-800">
                  {viewingPlanDetails.district}, {viewingPlanDetails.state}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Block / Location
                </span>
                <span className="font-bold text-slate-800">
                  {viewingPlanDetails.location || 'Assigned Areas'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Planned Period
                </span>
                <span className="font-bold text-slate-800">
                  {viewingPlanDetails.startDate} to {viewingPlanDetails.endDate}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Created On
                </span>
                <span className="font-semibold text-slate-700">
                  {viewingPlanDetails.createdAt.split('T')[0]}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                  Reviewed By
                </span>
                <span className="font-semibold text-slate-700">
                  {viewingPlanDetails.reviewedBy || 'Pending'}
                </span>
              </div>
            </div>

            {/* Budget Comparison Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Plan vs Actual Expenditure
              </h4>
              {(() => {
                const actuals = dataStore.getPlanActuals(viewingPlanDetails.id);
                const approvedBudget = viewingPlanDetails.approvedBudget || viewingPlanDetails.plannedBudget;
                return (
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                        <tr>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5">Planned (₹)</th>
                          <th className="p-2.5">Approved (₹)</th>
                          <th className="p-2.5">Actual Spent (₹)</th>
                          <th className="p-2.5 text-right">Variance (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="p-2.5 font-medium text-slate-700">Travelling</td>
                          <td className="p-2.5 text-slate-600">
                            ₹{viewingPlanDetails.plannedBudget.travelling.toLocaleString()}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800">
                            ₹{approvedBudget.travelling.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-slate-800">
                            ₹{actuals.actualTravelling.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-slate-700">
                            ₹{(approvedBudget.travelling - actuals.actualTravelling).toLocaleString()}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-medium text-slate-700">Lodging</td>
                          <td className="p-2.5 text-slate-600">
                            ₹{viewingPlanDetails.plannedBudget.lodging.toLocaleString()}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800">
                            ₹{approvedBudget.lodging.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-slate-800">
                            ₹{actuals.actualLodging.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-slate-700">
                            ₹{(approvedBudget.lodging - actuals.actualLodging).toLocaleString()}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-medium text-slate-700">Fooding</td>
                          <td className="p-2.5 text-slate-600">
                            ₹{viewingPlanDetails.plannedBudget.fooding.toLocaleString()}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800">
                            ₹{approvedBudget.fooding.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-slate-800">
                            ₹{actuals.actualFooding.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-slate-700">
                            ₹{(approvedBudget.fooding - actuals.actualFooding).toLocaleString()}
                          </td>
                        </tr>
                        <tr className="bg-slate-50 font-bold">
                          <td className="p-2.5 text-slate-900">Total</td>
                          <td className="p-2.5 text-slate-700">
                            ₹{viewingPlanDetails.plannedBudget.total.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-emerald-800">
                            ₹{approvedBudget.total.toLocaleString()}
                          </td>
                          <td className="p-2.5 text-slate-900">
                            ₹{actuals.actualTotal.toLocaleString()}
                          </td>
                          <td
                            className={`p-2.5 text-right ${
                              approvedBudget.total >= actuals.actualTotal
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }`}
                          >
                            ₹{(approvedBudget.total - actuals.actualTotal).toLocaleString()}{' '}
                            {approvedBudget.total >= actuals.actualTotal ? '(Savings)' : '(Over)'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Linked Activities */}
            {(() => {
              const actuals = dataStore.getPlanActuals(viewingPlanDetails.id);
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Field Activities Executed Under This Plan ({actuals.activities.length})</span>
                    {onNavigateToActivities && (
                      <button
                        onClick={() => {
                          setViewingPlanDetails(null);
                          onNavigateToActivities();
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer text-[11px]"
                      >
                        View in Field Activities →
                      </button>
                    )}
                  </div>
                  {actuals.activities.length === 0 ? (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                      No field activities logged yet during this planned window ({viewingPlanDetails.startDate} to {viewingPlanDetails.endDate}).
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {actuals.activities.map((act) => (
                        <div
                          key={act.id}
                          className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 mr-2">
                              {act.activityId}
                            </span>
                            <span className="font-bold text-slate-800">{act.activityType}</span>
                            <span className="text-slate-500 ml-1.5">
                              at {act.location || act.village} ({act.date})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-800">
                              ₹{(act.expenditure || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {act.participants} attendees
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {(() => {
              const canDeleteDetails =
                currentUser.role === 'admin' ||
                currentUser.role === 'manager' ||
                (currentUser.id === viewingPlanDetails.mobiliserId &&
                  (viewingPlanDetails.status === 'Draft' || viewingPlanDetails.status === 'Sent Back'));
              const canEditDetails =
                currentUser.role === 'admin' ||
                currentUser.role === 'manager' ||
                (currentUser.id === viewingPlanDetails.mobiliserId &&
                  (viewingPlanDetails.status === 'Draft' || viewingPlanDetails.status === 'Sent Back'));

              return (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  {canDeleteDetails ? (
                    <button
                      id={`details-delete-plan-${viewingPlanDetails.planId}`}
                      onClick={() => {
                        const p = viewingPlanDetails;
                        handleDeletePlan(p);
                      }}
                      className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Plan</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    {canEditDetails && (
                      <button
                        onClick={() => {
                          const p = viewingPlanDetails;
                          setViewingPlanDetails(null);
                          handleOpenEditModal(p);
                        }}
                        className="px-3.5 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Plan</span>
                      </button>
                    )}
                    <button
                      onClick={() => setViewingPlanDetails(null)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {planToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto text-rose-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">Delete Mobilisation Plan?</h3>
              <p className="text-xs text-slate-600">
                Are you sure you want to permanently delete plan{' '}
                <strong className="font-mono text-indigo-700 font-bold">{planToDelete.planId}</strong>{' '}
                ({planToDelete.programme} • {planToDelete.district})?
              </p>
              <p className="text-[11px] text-slate-400">
                This will remove the planned mobilisation period and budget allocation. Any recorded activities will remain safely logged.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="cancel-delete-plan-btn"
                onClick={() => setPlanToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-plan-btn"
                onClick={confirmExecuteDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Plan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
