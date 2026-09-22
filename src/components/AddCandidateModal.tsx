import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  MapPin,
  GraduationCap,
  Briefcase,
  FileCheck,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  UserCheck,
  Upload,
  FileText,
  Trash2,
  Check,
  HardDrive,
  Lock,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import {
  Candidate,
  CandidateStatus,
  DocumentType,
  User as UserType,
  PROJECT_OPTIONS,
  DDU_GKY_PHASES,
  DDU_GKY_CYCLES,
  DDU_GKY_BATCH_OPTIONS,
  CSR_RTD_BATCH_OPTIONS,
  BATCH_OPTIONS,
  CSR_BATCH_MAPPING,
  LEAD_SOURCE_OPTIONS,
  getApplicableDocumentsForProject,
  MIN_REQUIRED_DOCUMENTS_FOR_TRANSITION,
  normalizeDocumentName,
  evaluateDocumentTransition,
  DDU_GKY_MANDATORY_FORMS,
  STANDARD_YEAR_OPTIONS,
} from '../types';
import { getAllStates, getDistrictsForState, getBlocksForDistrict } from '../utils/locationData';
import { getUserAssignedState } from '../utils/userState';
import { appsScriptApi, GOOGLE_DRIVE_PARENT_FOLDER_ID } from '../services/api';
import {
  fileToBase64,
  formatDocumentSize,
  validateDocumentFile,
  StagedDocumentFile,
} from '../utils/documentUtils';

interface AddCandidateModalProps {
  onClose: () => void;
  onCandidateAdded: (newCandidate: Candidate) => void;
  onOpenExistingCandidate?: (candidateId: string) => void;
  currentUser: UserType;
}

export const AddCandidateModal: React.FC<AddCandidateModalProps> = ({
  onClose,
  onCandidateAdded,
  onOpenExistingCandidate,
  currentUser,
}) => {
  const [step, setStep] = useState(1);
  const [storeVersion, setStoreVersion] = useState(0);

  useEffect(() => {
    const unsub = dataStore.subscribe(() => setStoreVersion((v) => v + 1));
    return unsub;
  }, []);

  const districts = useMemo(() => dataStore.getDistricts(), [storeVersion]);
  const projects = useMemo(() => dataStore.getProjects(undefined, currentUser), [storeVersion, currentUser]);
  const batches = useMemo(() => dataStore.getBatches(), [storeVersion]);
  const mobilisers = useMemo(() => dataStore.getMobilisers(), [storeVersion]);

  // Form Fields
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dob, setDob] = useState('2003-05-15');
  const [age, setAge] = useState(22);
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');

  // Location Cascading State
  const availableStates = useMemo(() => getAllStates(), []);
  const initialLockedState =
    currentUser.role !== 'admin' && Boolean(currentUser.state) && currentUser.state !== 'All'
      ? (currentUser.state as string)
      : 'Nagaland';
  const [state, setState] = useState(initialLockedState);

  // Compute available districts for the selected state
  const availableDistricts = useMemo(() => {
    const list = getDistrictsForState(state);
    if (list.length > 0) return list;
    return districts
      .filter((d) => !d.stateName || d.stateName.toLowerCase() === state.toLowerCase())
      .map((d) => d.name);
  }, [state, districts]);

  const [district, setDistrict] = useState(() => {
    const defaultDist = currentUser.district || 'Kohima';
    const stateDistricts = getDistrictsForState(initialLockedState);
    return stateDistricts.includes(defaultDist) ? defaultDist : stateDistricts[0] || 'Kohima';
  });

  // Compute available blocks for the selected district and state
  const availableBlocks = useMemo(() => {
    return getBlocksForDistrict(district, state);
  }, [district, state]);

  const [block, setBlock] = useState(() => {
    const stateDistricts = getDistrictsForState(initialLockedState);
    const initialDist = stateDistricts.includes(currentUser.district || '') ? (currentUser.district as string) : stateDistricts[0] || 'Kohima';
    const initialBlocks = getBlocksForDistrict(initialDist, initialLockedState);
    return initialBlocks[0] || 'Kohima Sadar';
  });

  const [village, setVillage] = useState('');
  const [pincode, setPincode] = useState('797001');

  // Handler for state change: immediately updates district and block
  const handleStateChange = (newState: string) => {
    setState(newState);
    const newDistricts = getDistrictsForState(newState);
    if (newDistricts.length > 0) {
      const firstDistrict = newDistricts[0];
      setDistrict(firstDistrict);
      const newBlocks = getBlocksForDistrict(firstDistrict, newState);
      setBlock(newBlocks.length > 0 ? newBlocks[0] : '');
    } else {
      setDistrict('');
      setBlock('');
    }
  };

  // Handler for district change: immediately updates block
  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    const newBlocks = getBlocksForDistrict(newDistrict, state);
    setBlock(newBlocks.length > 0 ? newBlocks[0] : '');
  };

  // Safety synchronization effect: if availableDistricts doesn't contain current district, reset
  useEffect(() => {
    if (availableDistricts.length > 0 && !availableDistricts.includes(district)) {
      const firstDist = availableDistricts[0];
      setDistrict(firstDist);
      const newBlocks = getBlocksForDistrict(firstDist, state);
      if (newBlocks.length > 0 && !newBlocks.includes(block)) {
        setBlock(newBlocks[0]);
      }
    }
  }, [availableDistricts, district, state, block]);

  // Safety synchronization effect: if availableBlocks doesn't contain current block, reset
  useEffect(() => {
    if (availableBlocks.length > 0 && !availableBlocks.includes(block)) {
      setBlock(availableBlocks[0]);
    }
  }, [availableBlocks, block]);

  // Education
  const [qualification, setQualification] = useState('12th Pass');
  const [schoolCollege, setSchoolCollege] = useState('');
  const [passingYear, setPassingYear] = useState('2023');
  const [educationStatus, setEducationStatus] = useState<'Pursuing' | 'Dropped out' | 'Completed'>('Completed');

  // Allocation Fields (Programme, State, Year, Phase, Cycle, Batch)
  // Programme Master is the single source of truth!
  const isMobiliser = currentUser.role === 'mobiliser';
  const [project, setProject] = useState<string>('DDU-GKY 2.0');
  const [programmeState, setProgrammeState] = useState<string>(state);
  const [projectYear, setProjectYear] = useState<string>('2026-27');
  const [phase, setPhase] = useState<string>('');
  const [cycle, setCycle] = useState<string>('');
  const [batch, setBatch] = useState<string>('');

  // Keep programmeState in sync with candidate's location state if candidate changes state in Step 2
  useEffect(() => {
    if (state) {
      const statesForProg = dataStore.getStatesForProgramme(project);
      if (statesForProg.includes(state)) {
        setProgrammeState(state);
      } else if (statesForProg.includes('All States') || statesForProg.length === 0) {
        setProgrammeState(state);
      } else if (!statesForProg.includes(programmeState)) {
        setProgrammeState(statesForProg[0] || state);
      }
    }
  }, [state, project]);

  // Derived options directly from Programme Master single source of truth:
  const availableProgrammeStates = useMemo(() => {
    return dataStore.getStatesForProgramme(project);
  }, [project, storeVersion]);

  const availableYears = useMemo(() => {
    return dataStore.getYearsForProgrammeAndState(project, programmeState);
  }, [project, programmeState, storeVersion]);

  const availablePhases = useMemo(() => {
    return dataStore.getPhasesForProgrammeStateYear(project, programmeState, projectYear);
  }, [project, programmeState, projectYear, storeVersion]);

  const availableCycles = useMemo(() => {
    return dataStore.getCyclesForProgrammeStateYear(project, programmeState, projectYear, true, phase);
  }, [project, programmeState, projectYear, storeVersion, phase]);

  // When availableYears updates, ensure projectYear is valid
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(projectYear)) {
      setProjectYear(availableYears[0]);
    }
  }, [availableYears, projectYear]);

  // When availablePhases updates, validate phase
  useEffect(() => {
    if (availablePhases.length > 0) {
      if (phase && !availablePhases.includes(phase)) {
        setPhase(availablePhases[0]);
      }
    } else {
      if (phase) setPhase('');
    }
  }, [availablePhases, phase]);

  // When availableCycles updates, validate cycle
  useEffect(() => {
    if (availableCycles.length > 0) {
      if (cycle && !availableCycles.includes(cycle)) {
        setCycle(availableCycles[0]);
      }
    } else {
      if (cycle) setCycle('');
    }
  }, [availableCycles, cycle]);

  const handleProjectSelect = (newProj: string) => {
    setProject(newProj);
    setProgramme(newProj);
    const matchedProject = projects.find((p) => p.name === newProj);
    if (matchedProject) {
      setProjectId(matchedProject.id);
    }
    const statesForProg = dataStore.getStatesForProgramme(newProj);
    const nextState = statesForProg.includes(state)
      ? state
      : statesForProg.includes('All States')
      ? state
      : statesForProg[0] || state;
    setProgrammeState(nextState);

    const years = dataStore.getYearsForProgrammeAndState(newProj, nextState);
    const nextYear = years.includes(projectYear) ? projectYear : years[0] || '2026-27';
    setProjectYear(nextYear);

    const phases = dataStore.getPhasesForProgrammeStateYear(newProj, nextState, nextYear);
    setPhase(phases.length > 0 ? phases[0] : '');

    const cycles = dataStore.getCyclesForProgrammeStateYear(newProj, nextState, nextYear);
    setCycle(cycles.length > 0 ? cycles[0] : '');
  };

  // Programme & Mobilisation legacy compatibility
  const [programme, setProgramme] = useState('DDU-GKY 2.0');
  const [projectId, setProjectId] = useState(projects[0]?.id || 'proj-1');

  const handleProgrammeChange = (val: string) => {
    handleProjectSelect(val);
  };

  const handleProjectChange = (val: string) => {
    setProjectId(val);
    const matchedProject = projects.find((p) => p.id === val);
    if (matchedProject) {
      handleProjectSelect(matchedProject.name);
    }
  };
  const [batchId, setBatchId] = useState('');
  const [leadSource, setLeadSource] = useState<string>('Block Coordinator/Area Coordinator');
  const [leadSourceDetails, setLeadSourceDetails] = useState('');

  // Mobiliser Master Integration (Step 1 starts with Mobiliser Details)
  const userAssignedState = getUserAssignedState(currentUser);
  const isMobiliserStateLocked =
    currentUser.role !== 'admin' && Boolean(userAssignedState);
  const [selectedMobiliserState, setSelectedMobiliserState] = useState<string>(
    isMobiliserStateLocked ? (userAssignedState as string) : 'Nagaland'
  );

  const effectiveMobiliserState = isMobiliserStateLocked
    ? (userAssignedState as string)
    : selectedMobiliserState === 'All'
    ? undefined
    : selectedMobiliserState;

  // Programmes available for candidate registration (filtered by state for state mobiliser)
  const uniqueProjectNames = useMemo(() => {
    return dataStore.getProgrammes(false, effectiveMobiliserState, currentUser);
  }, [storeVersion, effectiveMobiliserState, currentUser]);

  // Mobilisers belonging to the logged-in user's state
  const activeFieldMobilisers = useMemo(() => {
    return dataStore.getFieldMobilisers(effectiveMobiliserState, true);
  }, [effectiveMobiliserState]);

  const [assignedMobiliserId, setAssignedMobiliserId] = useState<string>('');
  const [assignedMobiliserName, setAssignedMobiliserName] = useState<string>('');
  const [mobiliserPhone, setMobiliserPhone] = useState<string>('');
  const [mobiliserState, setMobiliserState] = useState<string>(
    isMobiliserStateLocked ? (currentUser.state as string) : 'Nagaland'
  );
  const [mobiliserStepError, setMobiliserStepError] = useState<string | null>(null);

  // Auto-match mobiliser name if logged in as a mobiliser whose name is in activeFieldMobilisers
  useEffect(() => {
    if (activeFieldMobilisers.length > 0 && !assignedMobiliserId) {
      const match = activeFieldMobilisers.find(
        (m) => m.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim()
      );
      if (match) {
        setAssignedMobiliserId(match.id);
        setAssignedMobiliserName(match.name);
        setMobiliserPhone(match.phone || '');
        setMobiliserState(match.state);
      }
    }
  }, [activeFieldMobilisers, currentUser.name, assignedMobiliserId]);

  const handleMobiliserChange = (mobId: string) => {
    setAssignedMobiliserId(mobId);
    setMobiliserStepError(null);
    const found = dataStore.getFieldMobiliserById(mobId);
    if (found) {
      setAssignedMobiliserName(found.name);
      setMobiliserPhone(found.phone || '');
      setMobiliserState(found.state);
      if (currentUser.role === 'admin' && found.state) {
        handleStateChange(found.state);
      }
    } else {
      setAssignedMobiliserName('');
      setMobiliserPhone('');
    }
  };

  const validateStep1Mobiliser = () => {
    if (!assignedMobiliserId) {
      setMobiliserStepError('Please select your Mobiliser Name from the dropdown before proceeding.');
      return false;
    }
    if (!mobiliserPhone.trim()) {
      setMobiliserStepError('Please enter your registered Mobiliser Contact Number before proceeding.');
      return false;
    }
    const cleanDigits = mobiliserPhone.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      setMobiliserStepError('Mobiliser Contact Number must be at least 10 digits.');
      return false;
    }
    setMobiliserStepError(null);
    return true;
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!validateStep1Mobiliser()) return;
      if (!name.trim()) {
        alert('Please enter Candidate Full Name.');
        return;
      }
      if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
        alert('Please enter a valid 10-digit Candidate Primary Mobile Number.');
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep > 1 && step === 1) {
      if (!validateStep1Mobiliser()) return;
    }
    setStep(targetStep);
  };

  // Dynamic placeholder helper for Lead Source Details
  const getLeadSourceDetailsPlaceholder = (source: string) => {
    if (source === 'Block Coordinator/Area Coordinator') {
      return 'Name of coordinator / area / block details';
    }
    if (source === 'SHG Meeting') {
      return 'Name of SHG / meeting location / relevant details';
    }
    if (source === 'Door to door mobilisation') {
      return 'e.g., Specific colony, cluster or household reference';
    }
    if (source === 'Village council meeting') {
      return 'e.g., Village council meeting details / location';
    }
    if (source === 'School / College visit') {
      return 'e.g., School or college name and coordinator';
    }
    return 'e.g., Additional notes, referral details, or specific campaign reference';
  };

  // Eligibility data preservation (Eligibility assessment is removed from New Candidate Wizard UI;
  // standard initial defaults are maintained in background for Google Sheets and data store consistency)
  const [ageEligible, setAgeEligible] = useState(true);
  const [educationEligible, setEducationEligible] = useState(true);
  const [eligibilityStatus, setEligibilityStatus] = useState<'Eligible' | 'Ineligible' | 'Pending Verification'>('Pending Verification');
  const [eligibilityRemarks, setEligibilityRemarks] = useState('');

  // Applicable project documents and candidate collection state
  const applicableDocs = useMemo(() => getApplicableDocumentsForProject(project), [project]);
  const [collectedDocs, setCollectedDocs] = useState<string[]>(['Aadhar Card', 'Passport Photo']);
  
  // Staged files for Google Drive upload (Candidate KYC Documents)
  const [stagedFiles, setStagedFiles] = useState<Record<string, StagedDocumentFile>>({});
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  const handleFileSelected = async (docName: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      alert(validation.error || 'Invalid file format');
      event.target.value = '';
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

      setStagedFiles((prev) => ({
        ...prev,
        [docName]: {
          documentType: docName,
          file,
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          base64Content: base64,
          previewUrl: file.type.startsWith('image/') ? base64 : undefined,
        },
      }));

      // Automatically check the document checkbox when a file is attached
      setCollectedDocs((prev) => (prev.includes(docName) ? prev : [...prev, docName]));
    } catch (err: any) {
      console.error('Failed to read file:', err);
      alert('Failed to read file: ' + (err?.message || 'Unknown error'));
    } finally {
      // Clear input so selecting the same file again triggers onChange
      event.target.value = '';
    }
  };

  const handleRemoveStagedFile = (docName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setStagedFiles((prev) => {
      const next = { ...prev };
      delete next[docName];
      return next;
    });
  };

  const toggleCollectedDoc = (doc: string) => {
    setCollectedDocs((prev) => {
      const isAlreadyChecked = prev.includes(doc);
      if (isAlreadyChecked) {
        // Also remove any staged file for this document if unchecked
        setStagedFiles((staged) => {
          const next = { ...staged };
          delete next[doc];
          return next;
        });
        return prev.filter((d) => d !== doc);
      } else {
        return [...prev, doc];
      }
    });
  };

  const selectAllDocs = () => {
    setCollectedDocs([...applicableDocs]);
  };

  const clearAllDocs = () => {
    setCollectedDocs([]);
    setStagedFiles({});
  };

  const transitionCheck = useMemo(
    () => evaluateDocumentTransition(project, collectedDocs),
    [project, collectedDocs]
  );
  const meetsDocRequirement = transitionCheck.canTransition;
  const missingDocs = useMemo(
    () => applicableDocs.filter((d) => !collectedDocs.includes(d)),
    [applicableDocs, collectedDocs]
  );

  // Duplicate warning state
  const [duplicates, setDuplicates] = useState<Candidate[]>([]);
  const [allowDuplicateBypass, setAllowDuplicateBypass] = useState(false);

  // Submission & API error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Auto-calculate Age on DOB change
  useEffect(() => {
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      if (!isNaN(calculatedAge) && calculatedAge > 0) {
        setAge(calculatedAge);
        setAgeEligible(calculatedAge >= 18 && calculatedAge <= 35);
      }
    }
  }, [dob]);

  // Real-time Duplicate Check
  useEffect(() => {
    if (phone.length >= 10 || (name.length > 3 && dob)) {
      const matches = dataStore.checkDuplicates(phone, alternatePhone, name, dob, fatherName);
      setDuplicates(matches);
    } else {
      setDuplicates([]);
    }
  }, [phone, alternatePhone, name, dob, fatherName]);

  // Fallback to save candidate to local storage and queue for offline synchronization
  const handleSaveOfflineQueue = () => {
    const assignedMob = mobilisers.find((m) => m.id === assignedMobiliserId);
    const selectedProjectObj = projects.find((p) => p.id === projectId);
    const selectedBatchObj = batches.find((b) => b.id === batchId);
    const candidateId = dataStore.generateCandidateId(state);
    const internalId = `c-${Date.now()}`;
    const now = new Date().toISOString();

    const candidateStatus: CandidateStatus = meetsDocRequirement ? 'New Lead' : 'Documents Pending';

    const stagedList = Object.values(stagedFiles) as StagedDocumentFile[];
    const offlineUploadedDocs = stagedList.map((staged) => ({
      documentType: staged.documentType,
      fileName: staged.fileName,
      fileUrl: `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_PARENT_FOLDER_ID}`,
      fileSize: staged.fileSize,
      mimeType: staged.mimeType,
      base64Content: staged.base64Content,
    }));

    const newCandidate = dataStore.addCandidate({
      id: internalId,
      candidateId,
      name: name.trim(),
      gender,
      dob,
      age,
      phone: phone.trim(),
      alternatePhone: alternatePhone.trim() || undefined,
      parentPhone: parentPhone.trim() || undefined,
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      address: `${village.trim() || 'Village Center'}, ${block}, ${district}`,
      state,
      district,
      block,
      village: village.trim() || 'Village Center',
      pincode: pincode.trim(),
      qualification,
      schoolCollege: schoolCollege.trim(),
      yearOfPassing: passingYear,
      educationStatus,
      programme: project,
      projectId,
      projectName: selectedProjectObj?.name || project,
      project,
      year: projectYear,
      phase: phase || undefined,
      cycle: cycle || undefined,
      batch: batch || undefined,
      batchId: batchId || 'b-1',
      batchName: batch || selectedBatchObj?.name || 'Batch 1',
      leadSource,
      leadSourceDetails: leadSourceDetails.trim() || undefined,
      assignedMobiliserId,
      assignedMobiliserName: assignedMobiliserName || (assignedMob ? assignedMob.name : currentUser.name),
      assignedMobiliserPhone: mobiliserPhone.trim(),
      assignedMobiliserState: mobiliserState,
      mobiliserPhone: mobiliserPhone.trim(),
      mobiliserState: mobiliserState,
      ageEligibility: ageEligible,
      educationEligibility: educationEligible,
      otherEligibility: true,
      eligibilityStatus: eligibilityStatus as 'Eligible' | 'Ineligible' | 'Pending Verification',
      eligibilityRemarks: eligibilityRemarks.trim() || undefined,
      collectedDocuments: collectedDocs,
      missingDocuments: missingDocs,
      documentsComplete: meetsDocRequirement,
      uploadedDocuments: offlineUploadedDocs,
      documentDriveLinks: {},
      stage: 'Pre-Mobilisation',
      currentStatus: candidateStatus,
      forceOfflineQueue: true,
      createdAt: now,
      updatedAt: now,
    });

    onCandidateAdded(newCandidate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Verify Step 1 Mobiliser Identification
    if (!validateStep1Mobiliser()) {
      setStep(1);
      return;
    }

    // Enforce State Lock: Mobilisers cannot register candidate outside their authorized state
    if (isMobiliserStateLocked && state !== currentUser.state) {
      alert(`As a State Mobiliser for ${currentUser.state}, you are only permitted to register candidates in ${currentUser.state}.`);
      setState(currentUser.state as string);
      setStep(2);
      return;
    }

    if (!name.trim()) {
      alert('Please enter candidate name.');
      setStep(1);
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      setStep(1);
      return;
    }

    // Strict duplicate check: prevent creating duplicate candidates across all users
    const cleanPhoneNum = phone.replace(/\D/g, '');
    const existingCandidate = dataStore.getCandidates().find(
      (c) => c.phone.replace(/\D/g, '') === cleanPhoneNum
    );
    if (existingCandidate) {
      alert(`A candidate with mobile number ${phone} already exists in the system:\n\nName: ${existingCandidate.name}\nCandidate ID: ${existingCandidate.candidateId}\nStage: ${existingCandidate.stage || 'Pre-Mobilisation'}\nStatus: ${existingCandidate.currentStatus}\n\nCandidates must remain one continuous record throughout the entire journey. Do not create duplicate records.`);
      if (onOpenExistingCandidate) {
        onOpenExistingCandidate(existingCandidate.id);
      }
      return;
    }

    const assignedMob = mobilisers.find((m) => m.id === assignedMobiliserId);
    const selectedProjectObj = projects.find((p) => p.id === projectId);
    const selectedBatchObj = batches.find((b) => b.id === batchId);

    // Generate candidate ID in NG-2026-XXXXX format based on state/year
    const candidateId = dataStore.generateCandidateId(state);
    const internalId = `c-${Date.now()}`;
    const now = new Date().toISOString();

    const candidateStatus: CandidateStatus = meetsDocRequirement ? 'New Lead' : 'Documents Pending';

    // 1. Collect all candidate form data
    const candidateData = {
      id: internalId,
      candidateId,
      name: name.trim(),
      gender,
      dob,
      age,
      phone: phone.trim(),
      alternatePhone: alternatePhone.trim() || undefined,
      parentPhone: parentPhone.trim() || undefined,
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      address: `${village.trim() || 'Village Center'}, ${block}, ${district}`,
      state,
      district,
      block,
      village: village.trim() || 'Village Center',
      pincode: pincode.trim(),
      qualification,
      schoolCollege: schoolCollege.trim(),
      yearOfPassing: passingYear,
      educationStatus,
      programme: project,
      projectId,
      projectName: selectedProjectObj?.name || project,
      project,
      year: projectYear,
      phase: phase || undefined,
      cycle: cycle || undefined,
      batch: batch || undefined,
      batchId: batchId || 'b-1',
      batchName: batch || selectedBatchObj?.name || 'Batch 1',
      leadSource,
      leadSourceDetails: leadSourceDetails.trim() || undefined,
      assignedMobiliserId,
      assignedMobiliserName: assignedMobiliserName || (assignedMob ? assignedMob.name : currentUser.name),
      assignedMobiliserPhone: mobiliserPhone.trim(),
      assignedMobiliserState: mobiliserState,
      mobiliserPhone: mobiliserPhone.trim(),
      mobiliserState: mobiliserState,
      ageEligibility: ageEligible,
      educationEligibility: educationEligible,
      otherEligibility: true,
      eligibilityStatus: eligibilityStatus as 'Eligible' | 'Ineligible' | 'Pending Verification',
      eligibilityRemarks: eligibilityRemarks.trim() || undefined,
      collectedDocuments: collectedDocs,
      missingDocuments: missingDocs,
      documentsComplete: meetsDocRequirement,
      stage: 'Pre-Mobilisation' as const,
      currentStatus: candidateStatus,
      createdAt: now,
      updatedAt: now,
    };

    // If application is offline, save to local store with offline queue item
    if (!dataStore.getIsOnline()) {
      const stagedList = Object.values(stagedFiles) as StagedDocumentFile[];
      const offlineUploadedDocs = stagedList.map((staged) => ({
        documentType: staged.documentType,
        fileName: staged.fileName,
        fileUrl: `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_PARENT_FOLDER_ID}`,
        fileSize: staged.fileSize,
        mimeType: staged.mimeType,
        base64Content: staged.base64Content,
      }));
      const newCandidate = dataStore.addCandidate({
        ...candidateData,
        uploadedDocuments: offlineUploadedDocs,
        documentDriveLinks: {},
        forceOfflineQueue: true,
      });
      onCandidateAdded(newCandidate);
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    // 1. Upload any staged documents to Google Drive first
    const stagedList = Object.values(stagedFiles) as StagedDocumentFile[];
    const uploadedResults: Record<string, { fileUrl: string; fileId: string }> = {};

    if (stagedList.length > 0) {
      setIsUploadingDrive(true);
      for (let i = 0; i < stagedList.length; i++) {
        const staged = stagedList[i];
        setUploadProgressText(
          `Uploading ${i + 1} of ${stagedList.length}: ${staged.documentType} to Google Drive...`
        );
        try {
          const upRes = await appsScriptApi.uploadCandidateDocument({
            candidateId,
            candidateName: name.trim(),
            documentType: staged.documentType,
            fileName: staged.fileName,
            mimeType: staged.mimeType,
            base64Content: staged.base64Content,
            parentFolderId: GOOGLE_DRIVE_PARENT_FOLDER_ID,
            uploadedBy: currentUser.name,
          });
          if (upRes && (upRes.fileUrl || upRes.fileId || upRes.data?.fileUrl)) {
            uploadedResults[staged.documentType] = {
              fileUrl: upRes.fileUrl || upRes.data?.fileUrl || '',
              fileId: upRes.fileId || upRes.data?.fileId || '',
            };
          }
        } catch (upErr) {
          console.warn(`Drive upload error for ${staged.documentType}:`, upErr);
        }
      }
      setIsUploadingDrive(false);
      setUploadProgressText('');
    }

    const uploadedDocsList = stagedList.map((staged) => ({
      documentType: staged.documentType,
      fileName: staged.fileName,
      fileUrl:
        uploadedResults[staged.documentType]?.fileUrl ||
        `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_PARENT_FOLDER_ID}`,
      driveFileId: uploadedResults[staged.documentType]?.fileId,
      fileSize: staged.fileSize,
      mimeType: staged.mimeType,
      base64Content: staged.base64Content,
    }));

    const driveLinksMap: Record<string, string> = {};
    Object.entries(uploadedResults).forEach(([docType, info]) => {
      if (info.fileUrl) driveLinksMap[docType] = info.fileUrl;
    });

    try {
      // Send all relevant candidate fields to Apps Script with action: "addCandidate"
      const payloadToSend = {
        action: 'addCandidate',
        candidateId,
        id: internalId,
        name: candidateData.name,
        gender: candidateData.gender,
        dob: candidateData.dob,
        age: candidateData.age,
        phone: candidateData.phone,
        alternatePhone: candidateData.alternatePhone || '',
        parentPhone: candidateData.parentPhone || '',
        fatherName: candidateData.fatherName,
        motherName: candidateData.motherName,
        address: candidateData.address,
        state: candidateData.state,
        district: candidateData.district,
        block: candidateData.block,
        village: candidateData.village,
        pincode: candidateData.pincode,
        qualification: candidateData.qualification,
        schoolCollege: candidateData.schoolCollege,
        yearOfPassing: candidateData.yearOfPassing,
        educationStatus: candidateData.educationStatus,
        programme: candidateData.programme,
        projectId: candidateData.projectId,
        projectName: candidateData.projectName,
        project: candidateData.project || '',
        year: candidateData.year || '2026-27',
        phase: candidateData.phase || '',
        cycle: candidateData.cycle || '',
        batch: candidateData.batch || '',
        batchId: candidateData.batchId,
        batchName: candidateData.batchName || '',
        leadSource: candidateData.leadSource,
        leadSourceDetails: candidateData.leadSourceDetails || '',
        assignedMobiliserId: candidateData.assignedMobiliserId,
        assignedMobiliserName: candidateData.assignedMobiliserName,
        assignedMobiliserPhone: candidateData.assignedMobiliserPhone || '',
        assignedMobiliserState: candidateData.assignedMobiliserState || '',
        mobiliserPhone: candidateData.assignedMobiliserPhone || '',
        mobiliserState: candidateData.assignedMobiliserState || '',
        ageEligibility: candidateData.ageEligibility,
        educationEligibility: candidateData.educationEligibility,
        otherEligibility: candidateData.otherEligibility,
        eligibilityStatus: candidateData.eligibilityStatus,
        eligibilityRemarks: candidateData.eligibilityRemarks || '',
        collectedDocuments: Array.isArray(candidateData.collectedDocuments)
          ? candidateData.collectedDocuments.join(', ')
          : '',
        documentsComplete: candidateData.documentsComplete,
        missingDocuments: Array.isArray(candidateData.missingDocuments)
          ? candidateData.missingDocuments.join(', ')
          : String(candidateData.missingDocuments || ''),
        uploadedDocuments: JSON.stringify(
          uploadedDocsList.map((u) => ({
            documentType: u.documentType,
            fileName: u.fileName,
            fileUrl: u.fileUrl,
            driveFileId: u.driveFileId,
          }))
        ),
        documentDriveLinks: JSON.stringify(driveLinksMap),
        googleDriveFolderId: GOOGLE_DRIVE_PARENT_FOLDER_ID,
        stage: candidateData.stage,
        currentStatus: candidateData.currentStatus,
        createdAt: candidateData.createdAt,
        updatedAt: candidateData.updatedAt,
      };

      const response = await appsScriptApi.addCandidate(payloadToSend);

      // 8. If the API fails: do not lose form data, show an appropriate error
      if (response && (response.success === false || response.status === 'error')) {
        const errorMsg =
          response.message ||
          response.error ||
          'Failed to save candidate to Apps Script backend.';
        setApiError(errorMsg);
        setIsSubmitting(false);
        return;
      }

      // 7. After a successful response:
      // Preserve candidate ID from server if returned, otherwise use generated candidateId
      const finalCandidateId = response?.candidateId || candidateId;
      const finalId = response?.id || internalId;

      const newCandidate = dataStore.addCandidate({
        ...candidateData,
        id: finalId,
        candidateId: finalCandidateId,
        uploadedDocuments: uploadedDocsList,
        documentDriveLinks: driveLinksMap,
      });

      setIsSubmitting(false);
      onCandidateAdded(newCandidate);

      // Automatically call getCandidates() from Apps Script API to sync latest Google Sheets data
      // Shows loading state in Candidate Directory while data is being retrieved
      dataStore.syncCandidatesFromGoogleSheets().catch((syncErr) => {
        console.warn('Background sync with Google Sheets completed with notice:', syncErr);
      });
    } catch (err: any) {
      setIsUploadingDrive(false);
      setUploadProgressText('');
      console.error('Apps Script API error while adding candidate:', err);
      setApiError(
        err?.message || 'Network error occurred while connecting to Apps Script. Form data is preserved.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
        {/* Wizard Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold">Register New Candidate</h2>
            <p className="text-xs text-slate-400">Step {step} of 5: Student Enrollment Wizard</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="grid grid-cols-5 border-b border-slate-200 text-center text-xs font-semibold shrink-0 bg-slate-50">
          {[
            { s: 1, label: 'Mobiliser & Personal' },
            { s: 2, label: 'Location' },
            { s: 3, label: 'Education' },
            { s: 4, label: 'Project & Allocation' },
            { s: 5, label: 'Documents' },
          ].map((item) => (
            <button
              key={item.s}
              type="button"
              onClick={() => handleStepClick(item.s)}
              className={`py-2 px-1 border-b-2 text-[11px] truncate cursor-pointer transition-colors ${
                step === item.s
                  ? 'border-indigo-600 text-indigo-700 bg-white font-bold'
                  : step > item.s
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-slate-400'
              }`}
            >
              {item.s}. {item.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Real-time Duplicate Warning Banner */}
          {duplicates.length > 0 && !allowDuplicateBypass && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Possible Duplicate Record Detected ({duplicates.length} match found)</span>
              </div>
              <p className="text-[11px] text-amber-700">
                A candidate with this phone number or matching details already exists in the system:
              </p>
              {duplicates.map((dup) => (
                <div key={dup.id} className="bg-white p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{dup.name}</span>{' '}
                    <span className="font-mono text-indigo-600">({dup.candidateId})</span>
                    <p className="text-[11px] text-slate-500">
                      Phone: {dup.phone} • {dup.district} • Mobiliser: {dup.assignedMobiliserName}
                    </p>
                  </div>
                  {onOpenExistingCandidate && (
                    <button
                      type="button"
                      onClick={() => onOpenExistingCandidate(dup.id)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Record</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllowDuplicateBypass(true)}
                  className="px-2.5 py-1 text-[11px] bg-amber-600 text-white font-semibold rounded hover:bg-amber-700"
                >
                  Continue Anyway (Different Candidate)
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: MOBILISER & PERSONAL INFORMATION */}
          {step === 1 && (
            <div className="space-y-4">
              {/* MANDATORY FIRST STEP: MOBILISER DETAILS */}
              <div className="bg-gradient-to-br from-indigo-50/80 via-blue-50/70 to-slate-50 border-2 border-indigo-200 rounded-2xl p-4 sm:p-4.5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>Mobiliser Details</span>
                        <span className="text-rose-500 font-bold">*</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Select your name from the Mobiliser Master and confirm your contact number before registering candidates
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isMobiliserStateLocked ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        State: {currentUser.state}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-[11px] font-bold text-slate-600 uppercase">State:</span>
                        <select
                          id="wizard-admin-mobiliser-state"
                          value={selectedMobiliserState}
                          onChange={(e) => {
                            const st = e.target.value;
                            setSelectedMobiliserState(st);
                            setAssignedMobiliserId('');
                            setAssignedMobiliserName('');
                            setMobiliserPhone('');
                            setMobiliserState(st === 'All' ? 'Nagaland' : st);
                          }}
                          className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Nagaland">Nagaland</option>
                          <option value="Assam">Assam</option>
                          <option value="Meghalaya">Meghalaya</option>
                          <option value="Manipur">Manipur</option>
                          <option value="All">All States (Admin View)</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {mobiliserStepError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-medium">{mobiliserStepError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1 flex items-center justify-between">
                      <span>Mobiliser Name *</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {activeFieldMobilisers.length} active in {effectiveMobiliserState || 'All States'}
                      </span>
                    </label>
                    <select
                      required
                      id="candidate-wizard-mobiliser-select"
                      value={assignedMobiliserId}
                      onChange={(e) => handleMobiliserChange(e.target.value)}
                      className="w-full p-2.5 bg-white border-2 border-indigo-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                    >
                      <option value="">-- Select Your Mobiliser Name --</option>
                      {activeFieldMobilisers.map((m, idx) => (
                        <option key={`cand-mob-${m.id}-${idx}`} value={m.id}>
                          {m.name} {!isMobiliserStateLocked ? `(${m.state})` : ''}
                        </option>
                      ))}
                    </select>
                    {activeFieldMobilisers.length === 0 && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        No active mobilisers found for {effectiveMobiliserState}. Please configure mobilisers in Admin Settings.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Mobiliser Contact No. *
                    </label>
                    <input
                      required
                      id="candidate-wizard-mobiliser-phone"
                      type="tel"
                      value={mobiliserPhone}
                      onChange={(e) => {
                        setMobiliserPhone(e.target.value);
                        setMobiliserStepError(null);
                      }}
                      placeholder="e.g., 9862012345"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-medium text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Confirm or enter your registered mobile number
                    </p>
                  </div>
                </div>
              </div>

              {/* CANDIDATE PERSONAL INFORMATION */}
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 pt-1">
                <User className="w-4 h-4 text-indigo-600" />
                Candidate Personal Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Candidate Full Name *</label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Toshi Jamir"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth *</label>
                  <input
                    required
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Age (Years) <span className="text-slate-400 font-normal">Auto-calculated</span>
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    min={15}
                    max={60}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Mobile Number *</label>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile (e.g., 9862000000)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alternate Mobile Number</label>
                  <input
                    type="tel"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    placeholder="Optional alternate number"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Parent / Guardian Contact</label>
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="Parent's mobile number"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Father's Name</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="Father's name"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mother's Name</label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="Mother's name"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LOCATION INFORMATION */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-600" />
                Location Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>State *</span>
                    {isMobiliserStateLocked && (
                      <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        Locked to {currentUser.state}
                      </span>
                    )}
                  </label>
                  {isMobiliserStateLocked ? (
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={state}
                        className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg font-semibold text-slate-800 cursor-not-allowed"
                      />
                    </div>
                  ) : (
                    <select
                      id="candidate-state-select"
                      value={state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                    >
                      {availableStates.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">District *</label>
                  <select
                    id="candidate-district-select"
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    {availableDistricts.map((dName) => (
                      <option key={dName} value={dName}>
                        {dName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Block *</label>
                  <select
                    id="candidate-block-select"
                    value={block}
                    onChange={(e) => setBlock(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    {availableBlocks.length > 0 ? (
                      availableBlocks.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))
                    ) : (
                      <option value="">No blocks found</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Village / Colony / Town *</label>
                  <input
                    required
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="e.g., Jotsoma Village, Ward 4"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="6-digit PIN code"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EDUCATION INFORMATION */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                Education Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Highest Qualification *</label>
                  <select
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="Below 10th">Below 10th</option>
                    <option value="10th Pass">10th Pass (High School)</option>
                    <option value="12th Pass">12th Pass (Higher Secondary)</option>
                    <option value="ITI">ITI Certified</option>
                    <option value="Diploma">Polytechnic / Diploma</option>
                    <option value="Graduate">Graduate (BA, BSc, BCom, BTech)</option>
                    <option value="Post Graduate">Post Graduate (MA, MSc, etc.)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Education Status *</label>
                  <select
                    value={educationStatus}
                    onChange={(e) => setEducationStatus(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="Completed">Completed Education</option>
                    <option value="Pursuing">Currently Studying / Pursuing</option>
                    <option value="Dropped out">Dropped out</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">School / College Name</label>
                  <input
                    type="text"
                    value={schoolCollege}
                    onChange={(e) => setSchoolCollege(e.target.value)}
                    placeholder="e.g., Kohima Science College"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Year of Passing</label>
                  <input
                    type="text"
                    value={passingYear}
                    onChange={(e) => setPassingYear(e.target.value)}
                    placeholder="e.g., 2023"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PROJECT & ALLOCATION */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  Project & Allocation Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="candidate-project-select" className="block font-semibold text-slate-700 mb-1">
                    Programme / Project *
                  </label>
                  <select
                    id="candidate-project-select"
                    value={project}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {uniqueProjectNames.map((pName) => (
                      <option key={pName} value={pName}>
                        {pName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="candidate-year-select" className="block font-semibold text-slate-700 mb-1">
                    Year *
                  </label>
                  <select
                    id="candidate-year-select"
                    value={projectYear}
                    onChange={(e) => setProjectYear(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {(availableYears.length > 0 ? availableYears : STANDARD_YEAR_OPTIONS).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="candidate-programme-state-select" className="block font-semibold text-slate-700 mb-1">
                    State (Programme Quota) *
                  </label>
                  <select
                    id="candidate-programme-state-select"
                    value={programmeState}
                    onChange={(e) => setProgrammeState(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {availableProgrammeStates.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="candidate-batch-select" className="block font-semibold text-slate-700 mb-1">
                    Batch (Optional for registration)
                  </label>
                  <select
                    id="candidate-batch-select"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Unassigned (Assign Post-Screening)</option>
                    {DDU_GKY_BATCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="candidate-phase-select" className="block font-semibold text-slate-700 mb-1">
                    Phase {availablePhases.length > 0 ? '(Optional)' : '(N/A)'}
                  </label>
                  <select
                    id="candidate-phase-select"
                    value={phase}
                    onChange={(e) => setPhase(e.target.value)}
                    disabled={availablePhases.length === 0}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">{availablePhases.length > 0 ? 'Unassigned' : 'Not configured'}</option>
                    {availablePhases.map((ph) => (
                      <option key={ph} value={ph}>
                        {ph}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="candidate-cycle-select" className="block font-semibold text-slate-700 mb-1">
                    Cycle {availableCycles.length > 0 ? '(Optional)' : '(N/A)'}
                  </label>
                  <select
                    id="candidate-cycle-select"
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                    disabled={availableCycles.length === 0}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">{availableCycles.length > 0 ? 'Unassigned' : 'Not configured'}</option>
                    {availableCycles.map((cy) => (
                      <option key={cy} value={cy}>
                        {cy}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong>Programme Master Sync:</strong> Options are live-synced from Programme Master for <strong>{project}</strong> ({programmeState}, {projectYear}).
                  </div>
                  {(availablePhases.length > 0 || availableCycles.length > 0) && (
                    <span className="text-[11px] font-mono text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                      {availablePhases.length} Phase{availablePhases.length !== 1 ? 's' : ''} | {availableCycles.length} Cycle{availableCycles.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assigned Field Mobiliser
                  </label>
                  <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{assignedMobiliserName || 'Selected in Step 1'}</span>
                      {mobiliserPhone && (
                        <span className="text-slate-600 font-mono ml-2">({mobiliserPhone})</span>
                      )}
                    </div>
                    {mobiliserState && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {mobiliserState}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Verified in Step 1 (Mobiliser Identification)
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead Source *</label>
                  <select
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                  >
                    {LEAD_SOURCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Lead Source Details</label>
                  <input
                    type="text"
                    value={leadSourceDetails}
                    onChange={(e) => setLeadSourceDetails(e.target.value)}
                    placeholder={getLeadSourceDetailsPlaceholder(leadSource)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: DOCUMENT COLLECTION & VERIFICATION */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-indigo-600" />
                    Document Collection ({project})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {project === 'DDU-GKY 2.0'
                      ? 'DDU-GKY 2.0 policy requires 2 mandatory forms + any 5 additional documents (total 7) for Stage 2 transition.'
                      : `Applicable documents for ${project}. Minimum 5 of ${applicableDocs.length} required for Stage 2 transition.`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                      meetsDocRequirement
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {meetsDocRequirement ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    {collectedDocs.length} of {applicableDocs.length} Collected
                    <span className="text-[10px] opacity-75">
                      ({meetsDocRequirement ? 'Policy Met' : `${project === 'DDU-GKY 2.0' ? 'Min. 7 (2+5)' : 'Min. 5'} required`})
                    </span>
                  </span>
                </div>
              </div>

              {/* Threshold Status Banner */}
              {meetsDocRequirement ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Document Policy Satisfied: </span>
                    <span>{transitionCheck.summaryMessage}</span>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      This candidate record is eligible to transition from Pre-Mobilisation to Post-Mobilisation (Confirmed Candidates).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex flex-col gap-1.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-950">Incomplete Documents Allowed: </span>
                      <span>{transitionCheck.summaryMessage}</span>
                    </div>
                  </div>

                  <div className="pl-6 space-y-1 text-[11px] text-amber-900">
                    {transitionCheck.missingMandatoryForms && transitionCheck.missingMandatoryForms.length > 0 && (
                      <div className="flex items-center gap-1.5 text-rose-700 font-semibold">
                        <span>• Missing Mandatory Forms:</span>
                        <span className="bg-rose-100/90 text-rose-900 px-1.5 py-0.2 rounded border border-rose-200">
                          {transitionCheck.missingMandatoryForms.join(', ')}
                        </span>
                      </div>
                    )}
                    {transitionCheck.additionalMissingCount !== undefined && transitionCheck.additionalMissingCount > 0 && (
                      <div>
                        • Additional Documents: {transitionCheck.additionalCount} of 5 collected ({transitionCheck.additionalMissingCount} more needed)
                      </div>
                    )}
                    <div className="text-amber-800/90">
                      Candidate will be saved safely under Pre-Mobilisation with status <strong className="font-bold text-amber-950">'Documents Pending'</strong>. You can register now and collect remaining documents later.
                    </div>
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between text-xs px-1 text-slate-600">
                <span>
                  Applicable for <strong className="text-slate-800">{project}</strong> ({applicableDocs.length} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllDocs}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline text-[11px]"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={clearAllDocs}
                    className="text-slate-500 hover:text-slate-700 cursor-pointer underline text-[11px]"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Google Drive Parent Folder & Security Notice */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs text-slate-700">
                <div className="flex items-center gap-2 min-w-0">
                  <HardDrive className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-800">Drive Folder ID:</span>{' '}
                    <code className="text-[11px] text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">
                      {GOOGLE_DRIVE_PARENT_FOLDER_ID}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    <Lock className="w-3 h-3 text-emerald-600" /> Restricted Access
                  </span>
                  {Object.keys(stagedFiles).length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      <FileText className="w-3 h-3 text-indigo-600" />
                      {Object.keys(stagedFiles).length} Files Attached
                    </span>
                  )}
                </div>
              </div>

              {/* Document Checklist & Drive Upload Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {applicableDocs.map((docName) => {
                  const isChecked = collectedDocs.includes(docName);
                  const isMandatory = (DDU_GKY_MANDATORY_FORMS as readonly string[]).includes(docName);
                  const stagedFile = stagedFiles[docName];
                  const docIdKey = docName.toLowerCase().replace(/[^a-z0-9]/g, '-');

                  return (
                    <div
                      key={docName}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                        stagedFile
                          ? 'bg-emerald-50/40 border-emerald-300 text-slate-900 shadow-2xs'
                          : isChecked
                          ? 'bg-indigo-50/40 border-indigo-200 text-indigo-950 shadow-2xs'
                          : 'bg-white hover:bg-slate-50/70 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id={`doc-check-${docIdKey}`}
                          checked={isChecked}
                          onChange={() => toggleCollectedDoc(docName)}
                          className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 shrink-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <label
                              htmlFor={`doc-check-${docIdKey}`}
                              className={`text-xs font-bold leading-snug cursor-pointer ${
                                isChecked ? 'text-indigo-950' : 'text-slate-800'
                              }`}
                            >
                              {docName}
                            </label>
                            <div className="flex items-center gap-1">
                              {isMandatory && (
                                <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                  Mandatory Form
                                </span>
                              )}
                              {stagedFile ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Attached
                                </span>
                              ) : isChecked ? (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.2 rounded">
                                  Collected
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                            {docName === 'Aadhar Card' && 'UIDAI identity proof'}
                            {docName === 'Pan Card' && 'Income Tax Department PAN identification'}
                            {docName === 'Birth Certificate' && 'Official age & birth record proof'}
                            {docName === 'Ration Card/Job Card/SHG Certificate/RSBY' && 'Family economic status / social group certificate'}
                            {docName === 'PRC' && 'Permanent Resident Certificate'}
                            {docName === 'Caste Certificate' && 'Official category certificate (ST/SC/OBC)'}
                            {docName === 'Marksheet & Admit Card' && 'Academic qualification marksheet / admit card'}
                            {docName === 'Passport Photo' && 'Recent passport sized color photograph'}
                            {docName === 'Bank Passbook' && 'Bank account details for DBT / stipends'}
                            {docName === 'On-field Registration Form' && 'Physical registration form filled on-field during mobilisation drives (Mandatory)'}
                            {docName === "Parent's Consent Form" && 'Signed parental/guardian consent form for residential training & placement (Mandatory)'}
                            {docName === 'Medical Certificate' && 'Medical fitness certificate from registered medical practitioner'}
                          </p>
                        </div>
                      </div>

                      {/* File Attachment & Upload Zone */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                        {stagedFile ? (
                          <div className="flex items-center justify-between gap-2 w-full bg-white border border-emerald-200 rounded-lg px-2 py-1 text-[11px] shadow-2xs">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-mono text-[11px] text-slate-800 truncate" title={stagedFile.fileName}>
                                {stagedFile.fileName}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({formatDocumentSize(stagedFile.fileSize)})
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <label
                                title="Change attached file"
                                className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                              >
                                Change
                                <input
                                  type="file"
                                  accept=".pdf,image/png,image/jpeg,image/jpg"
                                  onChange={(e) => handleFileSelected(docName, e)}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveStagedFile(docName, e)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="Remove attached file"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 w-full">
                            <label
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
                              title="Attach PDF scan or photo to upload directly to Google Drive"
                            >
                              <Upload className="w-3 h-3 text-indigo-600" />
                              <span>Attach PDF / Scan</span>
                              <input
                                type="file"
                                accept=".pdf,image/png,image/jpeg,image/jpg"
                                onChange={(e) => handleFileSelected(docName, e)}
                                className="hidden"
                              />
                            </label>
                            <span className="text-[10px] text-slate-400 font-medium">PDF, JPG, PNG ≤15MB</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                💡 <span className="font-semibold text-slate-700">Policy Note:</span> A candidate cannot transition from Pre-Mobilisation to Post-Mobilisation until the document requirements are fulfilled ({project === 'DDU-GKY 2.0' ? 'On-field Registration Form, Parent\'s Consent Form + at least 5 additional documents' : 'at least 5 applicable documents'}). Incomplete candidates are safely saved under 'Documents Pending' without creating duplicates.
              </div>
            </div>
          )}

          {/* Apps Script Backend API Error Banner */}
          {apiError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-900">Backend Sync Error</p>
                  <p className="text-rose-700 mt-0.5 leading-relaxed">{apiError}</p>
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">Form data is safe and untouched. You can retry or save directly to the local offline queue.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleSaveOfflineQueue}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                  title="Save locally and add to offline queue for synchronization"
                >
                  <span>Save to Offline Queue</span>
                </button>
              </div>
            </div>
          )}

          {/* Wizard Footer Navigation */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setStep(step - 1);
                  setApiError(null);
                }}
                disabled={isSubmitting}
                className="flex items-center gap-1 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-2 text-slate-500 text-xs font-semibold hover:text-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || isUploadingDrive}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isUploadingDrive ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{uploadProgressText || 'Uploading to Drive...'}</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Student...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Register & Save Student</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
