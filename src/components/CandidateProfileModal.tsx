import React, { useState, useMemo } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  FileCheck,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  GraduationCap,
  Briefcase,
  Upload,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  PhoneCall,
  CalendarClock,
  Plus,
  Award,
  Sparkles,
  Building2,
  DollarSign,
  Check,
  Lock,
  Layers,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  Candidate,
  CandidateStatus,
  CandidateStage,
  DocumentType,
  PRE_MOBILISATION_STATUSES,
  POST_MOBILISATION_STATUSES,
  getStageForStatus,
  PROJECT_OPTIONS,
  DDU_GKY_PHASES,
  DDU_GKY_CYCLES,
  BATCH_OPTIONS,
  CSR_BATCH_MAPPING,
  getApplicableDocumentsForProject,
  MIN_REQUIRED_DOCUMENTS_FOR_TRANSITION,
  normalizeDocumentName,
  DDU_GKY_MANDATORY_FORMS,
} from '../types';
import { dataStore } from '../services/dataStore';

interface CandidateProfileModalProps {
  candidateId: string;
  onClose: () => void;
  onOpenCallLogger: (candidateId: string) => void;
  onOpenFollowUpScheduler: (candidateId: string) => void;
}

export const CandidateProfileModal: React.FC<CandidateProfileModalProps> = ({
  candidateId,
  onClose,
  onOpenCallLogger,
  onOpenFollowUpScheduler,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'postmob' | 'calls' | 'followups' | 'documents'>('overview');
  const [candidate, setCandidate] = useState<Candidate | undefined>(dataStore.getCandidateById(candidateId));
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<CandidateStatus>(candidate?.currentStatus || 'New Lead');
  const [statusRemarks, setStatusRemarks] = useState('');
  const [uploadDocType, setUploadDocType] = useState<DocumentType>('Aadhaar');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Post-Mobilisation modals & forms
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [showPlacementModal, setShowPlacementModal] = useState(false);

  // Allocation State (Project, Phase, Cycle, Batch)
  const [allocProject, setAllocProject] = useState<string>(candidate?.project || candidate?.projectName || 'DDU-GKY 2.0');
  const [allocPhase, setAllocPhase] = useState<string>(candidate?.phase || '');
  const [allocCycle, setAllocCycle] = useState<string>(candidate?.cycle || '');
  const [allocBatch, setAllocBatch] = useState<string>(candidate?.batch || candidate?.batchName || '');
  const [allocRemarks, setAllocRemarks] = useState<string>('');

  const [screeningForm, setScreeningForm] = useState({
    status: candidate?.screening?.status || ('Screening Pending' as const),
    interestLevel: candidate?.screening?.interestLevel || ('High' as const),
    willingToRelocate: candidate?.screening?.willingToRelocate ?? true,
    careerPreference: candidate?.screening?.careerPreference || '',
    notes: candidate?.screening?.notes || '',
  });

  const [selectedBatchId, setSelectedBatchId] = useState(candidate?.batchId || '');

  const [placementForm, setPlacementForm] = useState({
    placementStatus: candidate?.placement?.placementStatus || ('Unplaced' as const),
    employerName: candidate?.placement?.employerName || '',
    designation: candidate?.placement?.designation || '',
    monthlySalary: candidate?.placement?.monthlySalary || '',
    placementLocation: candidate?.placement?.placementLocation || '',
    placementDate: candidate?.placement?.placementDate || '',
    retentionNotes: candidate?.placement?.retentionNotes || '',
    retentionStatus: candidate?.placement?.retentionStatus || ('Not Started' as const),
  });

  const currentUser = dataStore.getCurrentUser();
  const callLogs = dataStore.getCallLogs(undefined, candidate?.id);
  const followUps = dataStore.getFollowUps().filter((f) => f.candidateId === candidate?.id);
  const documents = dataStore.getDocuments(candidate?.id);
  const allBatches = dataStore.getBatches();
  const allProjects = dataStore.getProjects();
  const uniqueProjectNames = useMemo(() => {
    return Array.from(new Set(allProjects.map((p) => p.name)));
  }, [allProjects]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!candidate) return null;

  const handleDeleteCandidate = () => {
    if (!candidate) return;
    if (currentUser.role !== 'admin') {
      return;
    }
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!candidate) return;
    dataStore.deleteCandidate(candidate.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const currentStage: CandidateStage =
    candidate.stage ||
    (POST_MOBILISATION_STATUSES.includes(candidate.currentStatus as any)
      ? 'Post-Mobilisation'
      : 'Pre-Mobilisation');

  const handleUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusRemarks.trim()) return;

    const targetStage = getStageForStatus(newStatus);

    if (currentStage === 'Pre-Mobilisation' && targetStage === 'Post-Mobilisation') {
      const docCheck = dataStore.canTransitionToPostMobilisation(candidate.id);
      if (!docCheck.canTransition) {
        alert(
          `Transition Blocked by Document Policy:\n\nCandidate has collected only ${docCheck.collectedCount} of 5 required documents for ${docCheck.project}.\n\nMissing applicable documents:\n• ${docCheck.missingDocuments.join('\n• ')}\n\nCandidates must remain in Pre-Mobilisation with 'Documents Pending' until at least 5 applicable documents are collected. Status cannot be updated to ${newStatus}.`
        );
        return;
      }
    }

    dataStore.updateCandidateStatus(candidate.id, newStatus, currentUser.name, statusRemarks, targetStage);
    setCandidate(dataStore.getCandidateById(candidate.id));
    setShowStatusModal(false);
    setStatusRemarks('');
  };

  const handlePromoteToPostMobilisation = () => {
    const docCheck = dataStore.canTransitionToPostMobilisation(candidate.id);
    if (!docCheck.canTransition) {
      alert(
        `Transition Blocked by Document Policy:\n\nCandidate has collected only ${docCheck.collectedCount} of 5 required documents for ${docCheck.project}.\n\nMissing applicable documents:\n• ${docCheck.missingDocuments.join('\n• ')}\n\nCandidates must remain in Pre-Mobilisation with 'Documents Pending' until at least 5 applicable documents are collected. Please collect the remaining documents before promoting to Post-Mobilisation (Confirmed Candidates).`
      );
      setActiveTab('documents');
      return;
    }

    const remarks = prompt(
      'Enter remarks to promote candidate to Post-Mobilisation (Confirmed Candidates):',
      'All 5+ mandatory documents collected and candidate interest confirmed. Promoted to Post-Mobilisation for screening & batch allocation.'
    );
    if (remarks === null) return;
    dataStore.updateCandidateStatus(
      candidate.id,
      'Confirmed',
      currentUser.name,
      remarks || 'Promoted to Post-Mobilisation (Confirmed Candidates)',
      'Post-Mobilisation'
    );
    setCandidate(dataStore.getCandidateById(candidate.id));
    setActiveTab('postmob');
  };

  const handleSaveScreening = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    dataStore.recordScreening(candidate.id, {
      screeningDate: today,
      screenedBy: currentUser.name,
      result: screeningForm.status === 'Passed' ? 'Passed' : 'Failed',
      eligibility: screeningForm.status === 'Passed' ? 'Eligible' : 'Ineligible',
      remarks: screeningForm.notes,
    });
    dataStore.updateCandidate(candidate.id, {
      screening: {
        ...screeningForm,
        screenedBy: currentUser.name,
        screenedDate: today,
      },
    });
    setCandidate(dataStore.getCandidateById(candidate.id));
    setShowScreeningModal(false);
  };

  const isMobiliser = currentUser.role === 'mobiliser';

  const handleOpenAllocationModal = () => {
    if (isMobiliser) {
      alert('Permission Denied: Field Mobilisers cannot edit allocation fields (Project, Phase, Cycle, Batch). Final allocation is managed by Center Managers and Admins.');
      return;
    }
    const currentProj = candidate?.project || candidate?.projectName || candidate?.programme || 'DDU-GKY 2.0';
    setAllocProject(currentProj);
    setAllocPhase(candidate?.phase || (currentProj === 'DDU-GKY 2.0' ? 'Phase I' : ''));
    setAllocCycle(candidate?.cycle || (currentProj === 'DDU-GKY 2.0' ? 'Cycle 1' : ''));
    setAllocBatch(candidate?.batch || candidate?.batchName || (currentProj === 'DDU-GKY 2.0' ? 'Batch 1' : (CSR_BATCH_MAPPING[currentProj] || '')));
    setAllocRemarks('');
    setShowAllocationModal(true);
  };

  const handleAllocProjectChange = (newProj: string) => {
    setAllocProject(newProj);
    if (newProj && CSR_BATCH_MAPPING[newProj]) {
      setAllocBatch(CSR_BATCH_MAPPING[newProj]);
      setAllocPhase('');
      setAllocCycle('');
    } else if (newProj === 'DDU-GKY 2.0') {
      setAllocPhase('Phase I');
      setAllocCycle('Cycle 1');
      setAllocBatch('Batch 1');
    } else {
      setAllocPhase('');
      setAllocCycle('');
      setAllocBatch('');
    }
  };

  const handleSaveAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMobiliser) {
      alert('Field Mobilisers are not authorized to allocate batches.');
      return;
    }

    if (!allocProject) {
      alert('Please select a Project.');
      return;
    }

    // Post-mobilisation allocation mandatory requirements:
    if (allocProject === 'DDU-GKY 2.0') {
      if (!allocPhase) {
        alert('Phase is mandatory for DDU-GKY 2.0 allocation.');
        return;
      }
      if (!allocCycle) {
        alert('Cycle is mandatory for DDU-GKY 2.0 allocation.');
        return;
      }
      if (!allocBatch) {
        alert('Batch is mandatory for DDU-GKY 2.0 allocation.');
        return;
      }
    }

    const assignedBatchVal = allocProject.startsWith('CSR')
      ? (CSR_BATCH_MAPPING[allocProject] || allocProject)
      : allocBatch;

    dataStore.updateCandidate(
      candidate.id,
      {
        project: allocProject,
        phase: allocPhase || undefined,
        cycle: allocCycle || undefined,
        batch: assignedBatchVal,
        programme: allocProject,
        projectName: allocProject,
        batchName: assignedBatchVal,
      },
      allocRemarks || `Allocated to ${allocProject} ${assignedBatchVal}`
    );

    if (candidate.currentStatus === 'Confirmed' || candidate.currentStatus === 'Screening Completed') {
      dataStore.updateCandidateStatus(
        candidate.id,
        'Batch Assigned',
        currentUser.name,
        `Batch allocated: ${allocProject} - ${assignedBatchVal}`,
        'Post-Mobilisation'
      );
    }

    setCandidate(dataStore.getCandidateById(candidate.id));
    setShowAllocationModal(false);
  };

  const handleAssignBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) return;
    const bObj = allBatches.find((b) => b.id === selectedBatchId);
    dataStore.assignBatchToCandidate(
      candidate.id,
      selectedBatchId,
      currentUser.name,
      `Assigned to cohort: ${bObj?.name || selectedBatchId}`
    );
    setCandidate(dataStore.getCandidateById(candidate.id));
    setShowBatchModal(false);
  };

  const handleSavePlacement = (e: React.FormEvent) => {
    e.preventDefault();
    const outcome = placementForm.placementStatus === 'Placed' ? 'Placed' : 'Unplaced';
    dataStore.updatePlacementOutcome(
      candidate.id,
      outcome,
      {
        employer: placementForm.employerName,
        salary: placementForm.monthlySalary,
        placementDate: placementForm.placementDate,
        remarks: placementForm.retentionNotes,
      },
      currentUser.name
    );
    dataStore.updateCandidate(candidate.id, {
      placement: placementForm,
    });
    setCandidate(dataStore.getCandidateById(candidate.id));
    setShowPlacementModal(false);
  };

  const candProject = candidate.project || candidate.projectName || candidate.programme || 'DDU-GKY 2.0';
  const applicableDocs = getApplicableDocumentsForProject(candProject);
  const docTransitionCheck = dataStore.canTransitionToPostMobilisation(candidate.id);
  const collectedDocsList = dataStore.getCandidateCollectedDocuments(candidate);

  const handleToggleCollectedDoc = (docName: string) => {
    const isCurrentlyCollected = collectedDocsList.includes(docName);
    let newCollected: string[];
    if (isCurrentlyCollected) {
      newCollected = collectedDocsList.filter((d) => d !== docName);
    } else {
      newCollected = [...collectedDocsList, docName];
    }
    dataStore.setCandidateCollectedDocuments(candidate.id, newCollected);
    setCandidate({ ...dataStore.getCandidateById(candidate.id)! });
  };

  const handleSimulateDocUpload = (docType: DocumentType) => {
    const filename = `${docType.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${candidate.candidateId}.pdf`;
    dataStore.uploadDocument({
      candidateId: candidate.id,
      documentType: docType,
      fileName: filename,
    });
    setCandidate({ ...dataStore.getCandidateById(candidate.id)! });
    setShowUploadModal(false);
  };

  const handleVerifyDocument = (docId: string, status: 'Verified' | 'Rejected') => {
    let reason: string | undefined;
    if (status === 'Rejected') {
      reason = prompt('Please enter rejection reason (e.g., Unclear scan, Name mismatch):') || 'Document rejected during review';
    }
    dataStore.verifyDocument(docId, status, reason);
    setCandidate(dataStore.getCandidateById(candidate.id));
  };

  const cleanPhone = candidate.phone.replace(/\D/g, '');

  const allStatuses: CandidateStatus[] = [
    'New Lead',
    'Contacted',
    'Interested',
    'Not Interested',
    'Call Later',
    'Eligible',
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
    'Dropout',
    'Rejected',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
              {candidate.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold truncate">{candidate.name}</h2>
                <span className="font-mono text-xs text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                  {candidate.candidateId}
                </span>
                <span className="font-semibold text-xs text-indigo-200 bg-indigo-900/70 px-2 py-0.5 rounded border border-indigo-700">
                  {candidate.programme || candidate.projectName}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  candidate.currentStatus === 'Confirmed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  candidate.currentStatus === 'Interested' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                  candidate.currentStatus === 'Reported' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {candidate.currentStatus}
                </span>
                {/* Stage Badge */}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  currentStage === 'Post-Mobilisation'
                    ? 'bg-emerald-500/25 text-emerald-200 border-emerald-500/40'
                    : 'bg-blue-500/25 text-blue-200 border-blue-500/40'
                }`}>
                  {currentStage}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                <span>
                  {candidate.gender}, {candidate.age} yrs • {candidate.district}, {candidate.block}
                </span>
                <span>•</span>
                <span>
                  Mobiliser:{' '}
                  <span className="font-semibold text-white">{candidate.assignedMobiliserName || 'Unassigned'}</span>
                </span>
                {(candidate.assignedMobiliserPhone || candidate.mobiliserPhone) && (
                  <span className="bg-slate-800 text-emerald-400 font-mono px-1.5 py-0.5 rounded text-[11px] border border-slate-700">
                    📞 {candidate.assignedMobiliserPhone || candidate.mobiliserPhone}
                  </span>
                )}
                {(candidate.assignedMobiliserState || candidate.mobiliserState) && (
                  <span className="bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded text-[10px] border border-slate-700">
                    {candidate.assignedMobiliserState || candidate.mobiliserState}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser.role === 'admin' && (
              <button
                id="delete-candidate-btn"
                onClick={handleDeleteCandidate}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-red-300 hover:text-white bg-red-950/60 hover:bg-red-900 border border-red-800 rounded-lg transition-colors cursor-pointer"
                title="Delete Candidate (Admin only)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
            <button
              id="close-candidate-modal-btn"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Header Strip (Quick Call, WhatsApp, Status Update) */}
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2">
            {/* Quick Call */}
            <a
              href={`tel:${cleanPhone}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call ({cleanPhone})</span>
            </a>

            {/* Quick WhatsApp */}
            <a
              href={`https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(candidate.name)},%20greeting%20from%20Mobilisation%20Team.`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            {/* Log Call */}
            <button
              onClick={() => onOpenCallLogger(candidate.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5 text-indigo-600" />
              <span>Log Call</span>
            </button>

            {/* Schedule Follow-up */}
            <button
              onClick={() => onOpenFollowUpScheduler(candidate.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
              <span>Follow-up</span>
            </button>
          </div>

          <button
            id="change-status-btn"
            onClick={() => setShowStatusModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Change Status</span>
          </button>
        </div>

        {/* Two-Stage Workflow Context Strip */}
        <div className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs border-b ${
          currentStage === 'Post-Mobilisation'
            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
            : 'bg-blue-50/90 border-blue-200 text-blue-950'
        }`}>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
              currentStage === 'Post-Mobilisation'
                ? 'bg-emerald-700 text-white'
                : 'bg-blue-700 text-white'
            }`}>
              {currentStage}
            </span>
            <span className="text-xs font-medium text-slate-700 truncate">
              {currentStage === 'Pre-Mobilisation'
                ? 'Outreach, phone contact, and KYC verification stage.'
                : 'Continuous Record: Screening, batching, training, and placement.'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentStage === 'Pre-Mobilisation' ? (
              <button
                type="button"
                onClick={handlePromoteToPostMobilisation}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer"
                title="Promote candidate to Post-Mobilisation (Confirmed Candidates list)"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm & Move to Post-Mobilisation</span>
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded">
                Candidate ID: {candidate.candidateId} (Continuous Record)
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-4 bg-white text-xs font-semibold text-slate-500 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('postmob')}
            className={`py-3 px-3 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'postmob' ? 'border-emerald-600 text-emerald-700' : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Screening & Allocation</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              currentStage === 'Post-Mobilisation' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {candidate.placement?.placementStatus === 'Placed'
                ? 'Placed'
                : candidate.batchId
                ? 'Batched'
                : candidate.screening?.status === 'Passed'
                ? 'Screened'
                : 'Stage 2'}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className={`py-3 px-3 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'calls' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
            }`}
          >
            Call History ({callLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('followups')}
            className={`py-3 px-3 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'followups' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
            }`}
          >
            Follow-ups ({followUps.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-3 border-b-2 font-bold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'documents' ? 'border-indigo-600 text-indigo-600' : 'border-transparent hover:text-slate-800'
            }`}
          >
            Documents ({documents.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Personal & Contact Information */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-600" />
                  Personal & Contact Information
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-xl p-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400">Full Name</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{candidate.name}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Gender & DOB</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{candidate.gender}, {candidate.dob}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Father's Name</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{candidate.fatherName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Mother's Name</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{candidate.motherName || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Primary Contact</span>
                    <p className="font-semibold text-indigo-600 mt-0.5">{candidate.phone}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Alternate Contact</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{candidate.alternatePhone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Parent / Guardian Phone</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{candidate.parentPhone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Registered Date</span>
                    <p className="font-semibold text-slate-700 mt-0.5">{candidate.createdAt.split('T')[0]}</p>
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-600" />
                  Location Details
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white border border-slate-200 rounded-xl p-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400">State</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{candidate.state}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">District</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{candidate.district}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Block</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{candidate.block}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Village / Colony</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{candidate.village}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">PIN Code</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{candidate.pincode || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Education & Programme */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-slate-600" />
                    Education Information
                  </h3>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                    <div>
                      <span className="text-[11px] text-slate-400">Highest Qualification</span>
                      <p className="font-semibold text-slate-900">{candidate.qualification}</p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400">School / College</span>
                      <p className="font-semibold text-slate-900">{candidate.schoolCollege || '—'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Passing Year</span>
                        <p className="font-semibold text-slate-900">{candidate.passingYear || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Education Status</span>
                        <p className="font-semibold text-slate-900">{candidate.educationStatus}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-slate-600" />
                    Programme & Allocation Details
                  </h3>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Project</span>
                        <p className="font-semibold text-slate-900 mt-0.5 truncate" title={candidate.project || candidate.projectName || candidate.programme}>
                          {candidate.project || candidate.projectName || candidate.programme || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Phase</span>
                        <p className="font-semibold text-slate-900 mt-0.5">
                          {candidate.phase || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Cycle</span>
                        <p className="font-semibold text-slate-900 mt-0.5">
                          {candidate.cycle || '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Batch</span>
                        <p className="font-semibold text-indigo-700 mt-0.5">
                          {candidate.batch || candidate.batchName || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] text-slate-400">Lead Source</span>
                        <p className="font-semibold text-slate-900">{candidate.leadSource}</p>
                        {candidate.leadSourceDetails && (
                          <p className="text-[11px] text-slate-500 mt-0.5 italic">{candidate.leadSourceDetails}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">Assigned Mobiliser</span>
                        <p className="font-semibold text-indigo-600">{candidate.assignedMobiliserName || 'Unassigned'}</p>
                        {(candidate.assignedMobiliserPhone || candidate.mobiliserPhone) && (
                          <p className="text-[11px] text-slate-600 font-mono mt-0.5">
                            📞 {candidate.assignedMobiliserPhone || candidate.mobiliserPhone}
                          </p>
                        )}
                        {(candidate.assignedMobiliserState || candidate.mobiliserState) && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            State: {candidate.assignedMobiliserState || candidate.mobiliserState}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* POST-MOBILISATION TAB (Screening, Batch Allocation & Placement) */}
          {activeTab === 'postmob' && (
            <div className="space-y-6">
              {/* Stage Context Card */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <h3 className="text-sm font-bold text-emerald-950">Post-Mobilisation Management</h3>
                    <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                      Stage 2 Active
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1">
                    Continuous candidate profile (ID: {candidate.candidateId}). Covers center screening, batch assignment, training progress, and employment placement retention.
                  </p>
                </div>

                {currentStage === 'Pre-Mobilisation' && (
                  <button
                    type="button"
                    onClick={handlePromoteToPostMobilisation}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs shrink-0 cursor-pointer"
                  >
                    Confirm Candidate & Promote to Stage 2
                  </button>
                )}
              </div>

              {/* 1. Screening & Assessment Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Candidate Screening & Trade Assessment</h4>
                      <p className="text-[11px] text-slate-500">Center interview, interest assessment, and aptitude screening</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScreeningModal(true)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    {candidate.screening ? 'Edit Screening' : 'Record Screening'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400">Screening Status</span>
                    <p className="mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        candidate.screening?.status === 'Passed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : candidate.screening?.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : candidate.screening?.status === 'Exempted'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {candidate.screening?.status || 'Pending'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Interest Level</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {candidate.screening?.interestLevel || 'Not evaluated'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Willing to Relocate</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {candidate.screening?.willingToRelocate ? 'Yes (Willing)' : 'No (Local Only)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Preferred Trade</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {candidate.screening?.careerPreference || 'General / Any'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-400">Screening Remarks & Evaluation Notes</span>
                    <p className="font-medium text-slate-700 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      {candidate.screening?.notes || 'No screening notes recorded yet.'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-400">Evaluated By</span>
                    <p className="font-medium text-slate-700 mt-1">
                      {candidate.screening?.screenedBy ? `${candidate.screening.screenedBy} on ${candidate.screening.screenedDate || '—'}` : 'Not yet screened'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Batch Allocation & Training Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Cohort Allocation & Training Progress</h4>
                      <p className="text-[11px] text-slate-500">Project, Phase, Cycle, and Batch cohort allocation</p>
                    </div>
                  </div>
                  {isMobiliser ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs font-semibold cursor-not-allowed" title="Field mobilisers cannot edit allocation fields">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Allocation Locked (Mobiliser)</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenAllocationModal}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{candidate.batch || candidate.batchName ? 'Reallocate Cohort' : 'Allocate Cohort'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400">Project</span>
                    <p className="font-bold text-slate-900 mt-1 truncate" title={candidate.project || candidate.projectName || candidate.programme}>
                      {candidate.project || candidate.projectName || candidate.programme || 'Not Assigned'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Year</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {candidate.year || '2026-27'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Phase</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {candidate.phase || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Cycle</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {candidate.cycle || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Batch</span>
                    <p className="font-bold text-indigo-700 mt-1">
                      {candidate.batch || candidate.batchName || 'Not Assigned'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Training Status</span>
                    <p className="mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        candidate.trainingStatus === 'Training Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : candidate.trainingStatus === 'In Training'
                          ? 'bg-indigo-100 text-indigo-800'
                          : candidate.trainingStatus === 'Dropout'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {candidate.trainingStatus || 'Enrolled'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Placement & Retention Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Employment Placement & Retention Tracking</h4>
                      <p className="text-[11px] text-slate-500">Industry placement, salary CTC details, and 3-month retention tracking</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlacementModal(true)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    {candidate.placement?.placementStatus === 'Placed' ? 'Update Placement' : 'Record Placement'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400">Placement Status</span>
                    <p className="mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        candidate.placement?.placementStatus === 'Placed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : candidate.placement?.placementStatus === 'In Process'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {candidate.placement?.placementStatus || 'Unplaced'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Employer / Company</span>
                    <p className="font-bold text-slate-900 mt-1">
                      {candidate.placement?.employerName || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Job Designation</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {candidate.placement?.designation || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Monthly Salary (CTC)</span>
                    <p className="font-bold text-emerald-700 mt-1">
                      {candidate.placement?.monthlySalary ? `₹${candidate.placement.monthlySalary}` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Job Location</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {candidate.placement?.placementLocation || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400">Placement Date</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {candidate.placement?.placementDate || '—'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] text-slate-400">Retention Tracking Status</span>
                    <p className="mt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        candidate.placement?.retentionStatus === '3 Months Completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : candidate.placement?.retentionStatus === '2 Months Completed'
                          ? 'bg-sky-100 text-sky-800'
                          : candidate.placement?.retentionStatus === '1 Month Completed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {candidate.placement?.retentionStatus || 'Not Started'}
                      </span>
                    </p>
                  </div>
                  {candidate.placement?.retentionNotes && (
                    <div className="col-span-4">
                      <span className="text-[11px] text-slate-400">Retention & Mentor Notes</span>
                      <p className="font-medium text-slate-700 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        {candidate.placement.retentionNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. CALL HISTORY TAB */}
          {activeTab === 'calls' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Tele-calling Record</h3>
                  <p className="text-xs text-slate-500">Every call made to this candidate with outcomes and notes</p>
                </div>
                <button
                  onClick={() => onOpenCallLogger(candidate.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log New Call</span>
                </button>
              </div>

              {callLogs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <PhoneCall className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600">No tele-call logs recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {callLogs.map((log) => (
                    <div key={log.id} className="p-3.5 bg-white hover:bg-slate-50 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                            log.outcome === 'Interested' ? 'bg-sky-100 text-sky-800' :
                            log.outcome === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                            log.outcome === 'Not Interested' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {log.outcome}
                          </span>
                          <span className="font-semibold text-slate-800">{log.callDate} at {log.callTime}</span>
                        </div>
                        <span className="text-[11px] text-slate-500">By {log.mobiliserName}</span>
                      </div>
                      <p className="text-slate-700 mt-2 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {log.notes}
                      </p>
                      {log.followUpDate && (
                        <div className="mt-2 text-[11px] text-amber-700 font-semibold flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Follow-up scheduled for: {log.followUpDate} ({log.followUpRemarks})</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. FOLLOW-UPS TAB */}
          {activeTab === 'followups' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Scheduled Follow-ups</h3>
                  <p className="text-xs text-slate-500">Next interactions planned with candidate</p>
                </div>
                <button
                  onClick={() => onOpenFollowUpScheduler(candidate.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule Follow-up</span>
                </button>
              </div>

              {followUps.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <CalendarClock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600">No follow-ups scheduled.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {followUps.map((fup) => (
                    <div
                      key={fup.id}
                      className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        fup.status === 'completed'
                          ? 'bg-slate-50 border-slate-200 opacity-80'
                          : 'bg-white border-indigo-200 shadow-2xs'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            fup.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {fup.status.toUpperCase()}
                          </span>
                          <span className="font-bold text-slate-900">Target Date: {fup.followUpDate}</span>
                        </div>
                        <p className="text-slate-600 mt-1">{fup.remarks}</p>
                      </div>

                      {fup.status !== 'completed' && (
                        <button
                          onClick={() => {
                            dataStore.markFollowUpCompleted(fup.id);
                            setCandidate(dataStore.getCandidateById(candidate.id));
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer shadow-2xs"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-indigo-600" />
                    <span>Candidate Documents ({candProject})</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {candProject === 'DDU-GKY 2.0'
                      ? `Applicable documents for DDU-GKY 2.0. Total 7 required (2 mandatory forms + any 5 additional documents) to transition to Post-Mobilisation.`
                      : `Applicable documents for ${candProject}. Minimum 5 of ${applicableDocs.length} required to transition to Post-Mobilisation.`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                      docTransitionCheck.canTransition
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {docTransitionCheck.canTransition ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    {collectedDocsList.length} of {applicableDocs.length} Collected
                    <span className="text-[10px] opacity-75">
                      ({docTransitionCheck.canTransition ? 'Policy Met' : `${candProject === 'DDU-GKY 2.0' ? 'Min. 7 (2+5)' : 'Min. 5'} required`})
                    </span>
                  </span>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Document</span>
                  </button>
                </div>
              </div>

              {/* Requirement / Transition Status Banner */}
              {docTransitionCheck.canTransition ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Document Policy Satisfied: </span>
                      <span>{docTransitionCheck.summaryMessage}</span>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        This candidate record meets all compliance criteria to transition from Pre-Mobilisation to Post-Mobilisation (Confirmed Candidates) without duplicate registration.
                      </p>
                    </div>
                  </div>
                  {currentStage === 'Pre-Mobilisation' && (
                    <button
                      type="button"
                      onClick={handlePromoteToPostMobilisation}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors self-end sm:self-center"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm & Promote Now</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-950">Documents Pending (Stage 2 Transition Blocked):</span>
                      <p className="mt-0.5 font-medium">{docTransitionCheck.summaryMessage}</p>
                    </div>
                  </div>

                  <div className="pl-6 space-y-1 text-[11px] text-amber-900">
                    {docTransitionCheck.missingMandatoryForms && docTransitionCheck.missingMandatoryForms.length > 0 && (
                      <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                        <span>• Missing Mandatory Forms:</span>
                        <span className="bg-rose-100/90 text-rose-900 px-1.5 py-0.2 rounded border border-rose-200">
                          {docTransitionCheck.missingMandatoryForms.join(', ')}
                        </span>
                      </div>
                    )}
                    {docTransitionCheck.additionalMissingCount !== undefined && docTransitionCheck.additionalMissingCount > 0 && (
                      <div>
                        • Additional Documents: {docTransitionCheck.additionalCount} of 5 collected ({docTransitionCheck.additionalMissingCount} more needed)
                      </div>
                    )}
                    <div className="text-amber-800/90 italic">
                      Candidate remains safely in Pre-Mobilisation under 'Documents Pending'. Once requirements are met, this candidate will be unlocked for confirmation without creating duplicates.
                    </div>
                  </div>
                </div>
              )}

              {/* Missing Documents Alert if applicable */}
              {docTransitionCheck.missingDocuments.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-2">
                  <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900">Pending Applicable Documents ({docTransitionCheck.missingDocuments.length}):</span>
                    <p className="mt-0.5 text-slate-600">{docTransitionCheck.missingDocuments.join(', ')}</p>
                  </div>
                </div>
              )}

              {/* Documents Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {applicableDocs.map((docName) => {
                  const doc = documents.find(
                    (d) =>
                      normalizeDocumentName(d.documentType) === normalizeDocumentName(docName) ||
                      d.documentType === docName
                  );
                  const isCollected = collectedDocsList.includes(docName) || !!doc;

                  return (
                    <div
                      key={docName}
                      className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between transition-colors ${
                        isCollected ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isCollected}
                              onChange={() => handleToggleCollectedDoc(docName)}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div>
                              <span className={`font-bold ${isCollected ? 'text-slate-900' : 'text-slate-700'}`}>
                                {docName}
                              </span>
                              {(DDU_GKY_MANDATORY_FORMS as readonly string[]).includes(docName) && (
                                <span className="ml-1.5 text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  Mandatory Form
                                </span>
                              )}
                            </div>
                          </label>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              doc?.status === 'Verified'
                                ? 'bg-emerald-100 text-emerald-800'
                                : doc?.status === 'Uploaded'
                                ? 'bg-sky-100 text-sky-800'
                                : isCollected
                                ? 'bg-indigo-100 text-indigo-800'
                                : doc?.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {doc ? doc.status : isCollected ? 'Collected' : 'Pending Upload'}
                          </span>
                        </div>

                        {doc ? (
                          <div className="mt-2 text-slate-600">
                            <p className="font-mono text-[11px] truncate">{doc.fileName}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Uploaded on {doc.uploadedAt?.split('T')[0] || 'Recently'}
                            </p>
                            {doc.rejectionReason && (
                              <p className="text-[11px] text-rose-600 font-semibold mt-1">
                                Reason: {doc.rejectionReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-500 mt-1.5 text-[11px] leading-relaxed">
                            {docName === 'Aadhar Card' && 'UIDAI identity proof'}
                            {docName === 'Pan Card' && 'PAN identification for compliance'}
                            {docName === 'Birth Certificate' && 'Official age proof / birth record'}
                            {docName === 'Ration Card/Job Card/SHG Certificate/RSBY' && 'Social / economic category eligibility proof'}
                            {docName === 'PRC' && 'Permanent Resident Certificate'}
                            {docName === 'Caste Certificate' && 'ST / SC / OBC category certificate'}
                            {docName === 'Marksheet & Admit Card' && 'Highest education certificate & marksheet'}
                            {docName === 'Passport Photo' && 'Color photograph for registration & ID card'}
                            {docName === 'Bank Passbook' && 'Bank account details for DBT & stipend'}
                            {docName === 'On-field Registration Form' && 'Physical registration form filled on-field during mobilisation drives (Mandatory)'}
                            {docName === "Parent's Consent Form" && 'Signed parental/guardian consent form for residential training & placement (Mandatory)'}
                            {docName === 'Medical Certificate' && 'Medical fitness certificate from registered medical practitioner'}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        {doc ? (
                          <>
                            {doc.fileUrl && (
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors"
                                title="Open restricted document in Google Drive"
                              >
                                <ExternalLink className="w-3 h-3 text-indigo-600" />
                                <span>Drive File</span>
                              </a>
                            )}
                            {currentUser.role !== 'mobiliser' && doc.status === 'Uploaded' && (
                              <div className="flex items-center gap-1.5 w-full">
                                <button
                                  onClick={() => handleVerifyDocument(doc.id, 'Verified')}
                                  className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Verify
                                </button>
                                <button
                                  onClick={() => handleVerifyDocument(doc.id, 'Rejected')}
                                  className="flex-1 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-semibold cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                            {doc.status === 'Verified' && (
                              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verified by {doc.verifiedBy}
                              </span>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setUploadDocType(docName as DocumentType);
                              setShowUploadModal(true);
                            }}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Upload className="w-3 h-3" /> Upload File
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Status Change Modal */}
        {showStatusModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
            <form onSubmit={handleUpdateStatus} className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">Update Candidate Status</h4>
                <button type="button" onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as CandidateStatus)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                >
                  <optgroup label="Stage 1: Pre-Mobilisation Statuses">
                    {PRE_MOBILISATION_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Stage 2: Post-Mobilisation Statuses">
                    {POST_MOBILISATION_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {currentStage === 'Pre-Mobilisation' && POST_MOBILISATION_STATUSES.includes(newStatus as any) && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg text-xs flex items-start gap-1.5 ${
                      docTransitionCheck.canTransition
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {docTransitionCheck.canTransition ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      {docTransitionCheck.canTransition ? (
                        <span>
                          <strong>Document requirement satisfied ({docTransitionCheck.summaryMessage}):</strong> Selecting <strong>{newStatus}</strong> will promote this candidate to <strong>Post-Mobilisation</strong>. Candidate ID ({candidate.candidateId}) remains the same continuous record without duplicates.
                        </span>
                      ) : (
                        <span>
                          <strong>Transition Blocked by Document Policy:</strong> {docTransitionCheck.summaryMessage}. A candidate cannot transition to Post-Mobilisation until requirements are satisfied. Candidate will remain in Pre-Mobilisation under Documents Pending without creating duplicates.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks / Reason for Status Change *
                </label>
                <textarea
                  required
                  rows={3}
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  placeholder="e.g., Parent confirmed joining batch starting 15th March"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Upload Document Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Upload Candidate Document</h4>
                  <p className="text-[11px] text-slate-500">Project: {candProject}</p>
                </div>
                <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type *</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value as DocumentType)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                >
                  <optgroup label={`Applicable Documents for ${candProject}`}>
                    {applicableDocs.map((docName) => (
                      <option key={docName} value={docName}>
                        {docName}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other Supporting Documents">
                    <option value="Other">Other</option>
                  </optgroup>
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50">
                <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Choose file or take camera photo</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF, JPG, PNG up to 5MB</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSimulateDocUpload(uploadDocType)}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Simulate Upload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Screening Assessment Modal */}
        {showScreeningModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
            <form onSubmit={handleSaveScreening} className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Screening & Trade Assessment</h4>
                  <p className="text-xs text-slate-500">Center evaluation for {candidate.name}</p>
                </div>
                <button type="button" onClick={() => setShowScreeningModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Screening Result *</label>
                  <select
                    value={screeningForm.status}
                    onChange={(e) => setScreeningForm({ ...screeningForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="Passed">Passed (Eligible for Batch)</option>
                    <option value="Screening Pending">Screening Pending</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Exempted">Exempted</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Interest Level</label>
                  <select
                    value={screeningForm.interestLevel}
                    onChange={(e) => setScreeningForm({ ...screeningForm, interestLevel: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="High">High (Very Keen)</option>
                    <option value="Medium">Medium (Needs Guidance)</option>
                    <option value="Low">Low (Hesitant)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Willing to Relocate for Training / Job?</label>
                  <select
                    value={screeningForm.willingToRelocate ? 'Yes' : 'No'}
                    onChange={(e) => setScreeningForm({ ...screeningForm, willingToRelocate: e.target.value === 'Yes' })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="Yes">Yes, willing to relocate</option>
                    <option value="No">No, local placement only</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferred Trade / Job Domain</label>
                  <input
                    type="text"
                    value={screeningForm.careerPreference}
                    onChange={(e) => setScreeningForm({ ...screeningForm, careerPreference: e.target.value })}
                    placeholder="e.g., Hospitality, Retail, IT-ITeS"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Screening Assessment Notes</label>
                  <textarea
                    rows={3}
                    value={screeningForm.notes}
                    onChange={(e) => setScreeningForm({ ...screeningForm, notes: e.target.value })}
                    placeholder="Candidate communication skills, interest, guardian consensus, etc."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScreeningModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cohort & Batch Allocation Modal (Continuous Candidate Record) */}
        {showAllocationModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
            <form onSubmit={handleSaveAllocation} className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Cohort & Batch Allocation</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Candidate: <span className="font-semibold text-slate-700">{candidate.name}</span> ({candidate.candidateId})
                  </p>
                </div>
                <button type="button" onClick={() => setShowAllocationModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs text-indigo-950">
                <span className="font-bold">Continuous Record:</span> Project, Phase, Cycle, and Batch are saved as distinct fields and synchronized to Google Sheets.
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Project *</label>
                  <select
                    value={allocProject}
                    onChange={(e) => handleAllocProjectChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900"
                  >
                    {uniqueProjectNames.map((pName) => (
                      <option key={pName} value={pName}>
                        {pName}
                      </option>
                    ))}
                  </select>
                </div>

                {allocProject === 'DDU-GKY 2.0' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Phase * (DDU-GKY)</label>
                        <select
                          required
                          value={allocPhase}
                          onChange={(e) => setAllocPhase(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900"
                        >
                          <option value="">Select Phase...</option>
                          {DDU_GKY_PHASES.map((ph) => (
                            <option key={ph} value={ph}>
                              {ph}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Cycle * (DDU-GKY)</label>
                        <select
                          required
                          value={allocCycle}
                          onChange={(e) => setAllocCycle(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900"
                        >
                          <option value="">Select Cycle...</option>
                          {DDU_GKY_CYCLES.map((cy) => (
                            <option key={cy} value={cy}>
                              {cy}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Batch * (DDU-GKY)</label>
                      <select
                        required
                        value={allocBatch}
                        onChange={(e) => setAllocBatch(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-900"
                      >
                        <option value="">Select Batch...</option>
                        {BATCH_OPTIONS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : allocProject.startsWith('CSR') ? (
                  <div className="space-y-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Batch (Auto-Mapped for CSR)</label>
                      <input
                        type="text"
                        readOnly
                        value={CSR_BATCH_MAPPING[allocProject] || allocProject}
                        className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-not-allowed"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Phase and Cycle are not applicable for CSR projects. The batch is automatically matched to the project name.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Batch (RTD)</label>
                    <input
                      type="text"
                      readOnly
                      value="Pending RTD Definition"
                      className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-slate-500 italic cursor-not-allowed"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Allocation Remarks</label>
                  <textarea
                    rows={2}
                    value={allocRemarks}
                    onChange={(e) => setAllocRemarks(e.target.value)}
                    placeholder="e.g., Allocated post counseling based on trade preference"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAllocationModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Allocation
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Batch Allocation Modal */}
        {showBatchModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
            <form onSubmit={handleAssignBatch} className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Assign Training Batch</h4>
                  <p className="text-xs text-slate-500">Allocate cohort for {candidate.name}</p>
                </div>
                <button type="button" onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Batch *</label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="">Select a batch...</option>
                    {allBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.projectName || b.district})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedBatchId}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold shadow-xs"
                >
                  Assign Batch
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Placement Tracking Modal */}
        {showPlacementModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
            <form onSubmit={handleSavePlacement} className="bg-white rounded-xl p-5 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Placement & Retention Record</h4>
                  <p className="text-xs text-slate-500">Record employment outcome for {candidate.name}</p>
                </div>
                <button type="button" onClick={() => setShowPlacementModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Placement Status *</label>
                  <select
                    value={placementForm.placementStatus}
                    onChange={(e) => setPlacementForm({ ...placementForm, placementStatus: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="Unplaced">Unplaced</option>
                    <option value="In Process">In Process (Interviews Active)</option>
                    <option value="Placed">Placed (Offer Letter Issued / Joined)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Employer / Company Name</label>
                  <input
                    type="text"
                    value={placementForm.employerName}
                    onChange={(e) => setPlacementForm({ ...placementForm, employerName: e.target.value })}
                    placeholder="e.g., Tata Consultancy Services"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Designation / Role</label>
                  <input
                    type="text"
                    value={placementForm.designation}
                    onChange={(e) => setPlacementForm({ ...placementForm, designation: e.target.value })}
                    placeholder="e.g., Customer Support Associate"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monthly Salary CTC (₹)</label>
                  <input
                    type="text"
                    value={placementForm.monthlySalary}
                    onChange={(e) => setPlacementForm({ ...placementForm, monthlySalary: e.target.value })}
                    placeholder="e.g., 18500"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Placement Location</label>
                  <input
                    type="text"
                    value={placementForm.placementLocation}
                    onChange={(e) => setPlacementForm({ ...placementForm, placementLocation: e.target.value })}
                    placeholder="e.g., Guwahati, Dimapur, Bangalore"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Placement Joining Date</label>
                  <input
                    type="date"
                    value={placementForm.placementDate}
                    onChange={(e) => setPlacementForm({ ...placementForm, placementDate: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Retention Status</label>
                  <select
                    value={placementForm.retentionStatus}
                    onChange={(e) => setPlacementForm({ ...placementForm, retentionStatus: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="1 Month Completed">1 Month Completed</option>
                    <option value="2 Months Completed">2 Months Completed</option>
                    <option value="3 Months Completed">3 Months Completed (Fully Retained)</option>
                    <option value="Left / Dropped">Left / Dropped Out</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Retention Verification & Mentor Notes</label>
                  <textarea
                    rows={2}
                    value={placementForm.retentionNotes}
                    onChange={(e) => setPlacementForm({ ...placementForm, retentionNotes: e.target.value })}
                    placeholder="Salary slip verified, candidate happy in workplace, etc."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlacementModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Placement
                </button>
              </div>
            </form>
          </div>
        )}
        {/* Admin Delete Candidate In-App Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Candidate Master Record</h3>
                  <p className="text-xs text-slate-500 font-mono">{candidate.candidateId}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete candidate <strong className="text-slate-900">{candidate.name}</strong>?
                This will remove the candidate and all linked documents, call logs, and follow-ups. This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-delete-candidate-profile-btn"
                  onClick={confirmDelete}
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
    </div>
  );
};
