export type UserRole = 'admin' | 'manager' | 'mobiliser';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  state: string;
  district: string;
  assignedBlocks: string[];
  avatar?: string;
  status: 'active' | 'inactive';
  monthlyTarget: number;
}

export interface FieldMobiliser {
  id: string;
  name: string;
  state: string;
  district?: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive';
  monthlyTarget?: number;
  createdAt?: string;
}

export type CandidateStage = 'Pre-Mobilisation' | 'Post-Mobilisation';

export type PreMobilisationStatus =
  | 'New Lead'
  | 'Contacted'
  | 'Interested'
  | 'Follow-up Required'
  | 'Not Interested'
  | 'Confirmed'
  | 'Documents Pending'
  | 'Documents Complete';

export type PostMobilisationStatus =
  | 'Confirmed Candidates'
  | 'Screening Pending'
  | 'Screening Completed'
  | 'Eligible'
  | 'Ready for Batch'
  | 'Batch Assigned'
  | 'Training Started'
  | 'Training Completed'
  | 'Placed'
  | 'Unplaced'
  | 'Dropout';

export type CandidateStatus =
  | PreMobilisationStatus
  | PostMobilisationStatus
  // Legacy / transition backward compatibility:
  | 'Call Later'
  | 'Reporting Pending'
  | 'Reported'
  | 'Rejected';

export const PRE_MOBILISATION_STATUSES: PreMobilisationStatus[] = [
  'New Lead',
  'Contacted',
  'Interested',
  'Follow-up Required',
  'Not Interested',
  'Confirmed',
  'Documents Pending',
  'Documents Complete',
];

export const POST_MOBILISATION_STATUSES: PostMobilisationStatus[] = [
  'Confirmed Candidates',
  'Screening Pending',
  'Screening Completed',
  'Eligible',
  'Ready for Batch',
  'Batch Assigned',
  'Training Started',
  'Training Completed',
  'Placed',
  'Unplaced',
  'Dropout',
];

export function getStageForStatus(status: CandidateStatus): CandidateStage {
  if (
    POST_MOBILISATION_STATUSES.includes(status as PostMobilisationStatus) ||
    status === 'Reported' ||
    status === 'Reporting Pending'
  ) {
    return 'Post-Mobilisation';
  }
  return 'Pre-Mobilisation';
}

export const PROJECT_OPTIONS = [
  'DDU-GKY 2.0',
  'CSR - Raddison',
  'CSR - Oberoi',
  'CSR',
  'RTD',
] as const;
export type ProjectOption = (typeof PROJECT_OPTIONS)[number];

export const DDU_GKY_PHASES = ['Phase I', 'Phase II', 'Phase III', 'Phase 4'] as const;
export type DduGkyPhase = (typeof DDU_GKY_PHASES)[number];

export const DDU_GKY_CYCLES = ['Cycle 1', 'Cycle 2', 'Cycle 3'] as const;
export type DduGkyCycle = (typeof DDU_GKY_CYCLES)[number];

export const DDU_GKY_BATCH_OPTIONS = [
  'Batch 1',
  'Batch 2',
  'Batch 3',
  'Batch 4',
  'Batch 5',
  'Batch 6',
  'Batch 7',
] as const;
export type DduGkyBatchOption = (typeof DDU_GKY_BATCH_OPTIONS)[number];

export const CSR_RTD_BATCH_OPTIONS = [
  'Batch 1',
  'Batch 2',
  'Batch 3',
] as const;
export type CsrRtdBatchOption = (typeof CSR_RTD_BATCH_OPTIONS)[number];

export const BATCH_OPTIONS = [
  'Batch 1',
  'Batch 2',
  'Batch 3',
  'Batch 4',
  'Batch 5',
  'Batch 6',
  'Batch 7',
  'Batch 8',
  'Batch 9',
  'Batch 10',
] as const;
export type BatchOption = (typeof BATCH_OPTIONS)[number];

export const CSR_BATCH_MAPPING: Record<string, string> = {
  'CSR - Raddison': 'Batch 1',
  'CSR - Oberoi': 'Batch 1',
  'CSR': 'Batch 1',
  'RTD': 'Batch 1',
  'CSR - Raddison 1': 'Batch 1',
  'CSR - Raddison 2': 'Batch 2',
};

export const LEAD_SOURCE_OPTIONS = [
  'Block Coordinator/Area Coordinator',
  'SHG Meeting',
  'Door to door mobilisation',
  'Village council meeting',
  'School / College visit',
  'Church / Community announcement',
  'Referral from existing student',
  'Flyer / Poster campaign',
  'Social Media',
  'Self / Walk-in',
] as const;
export type LeadSourceOption = (typeof LEAD_SOURCE_OPTIONS)[number];

export interface AllocationHistoryEntry {
  id: string;
  candidateId: string;
  previousAllocation: {
    project?: string;
    state?: string;
    year?: string;
    phase?: string;
    cycle?: string;
    batch?: string;
  };
  newAllocation: {
    project?: string;
    state?: string;
    year?: string;
    phase?: string;
    cycle?: string;
    batch?: string;
  };
  changedBy: string;
  changedById?: string;
  changedAt: string;
  remarks?: string;
}

export interface Candidate {
  id: string;
  candidateId: string; // e.g. NG-2026-00001
  name: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string;
  age: number;
  fatherName: string;
  motherName: string;
  phone: string;
  alternatePhone?: string;
  parentPhone?: string;
  address: string;
  state: string;
  district: string;
  block: string;
  village: string;
  pincode: string;
  qualification: string;
  schoolCollege: string;
  yearOfPassing?: string;
  educationStatus?: string;
  // Separate Project / Phase / Cycle / Batch / Year fields (Google Sheets columns)
  project?: string;
  year?: string;
  phase?: string;
  cycle?: string;
  batch?: string;
  allocationHistory?: AllocationHistoryEntry[];

  projectId: string;
  projectName?: string;
  programme: string;
  batchId: string;
  batchName?: string;
  leadSource: string;
  leadSourceDetails?: string;
  assignedMobiliserId: string;
  assignedMobiliserName?: string;
  assignedMobiliserPhone?: string;
  assignedMobiliserState?: string;
  mobiliserPhone?: string;
  mobiliserState?: string;
  
  // Eligibility
  ageEligibility: boolean;
  educationEligibility: boolean;
  otherEligibility: boolean;
  eligibilityStatus: 'Eligible' | 'Ineligible' | 'Pending Verification';
  eligibilityRemarks?: string;
  
  // Documents
  documentsComplete: boolean;
  missingDocuments: string[];
  collectedDocuments?: string[];
  uploadedDocuments?: Array<{
    documentType: string;
    fileName: string;
    fileUrl: string;
    driveFileId?: string;
    fileSize?: number;
    mimeType?: string;
    base64Content?: string;
  }>;
  documentDriveLinks?: Record<string, string>;
  
  // Stage & Master Status
  stage?: CandidateStage;
  currentStatus: CandidateStatus;
  
  // Post-Mobilisation Screening details
  screeningDate?: string;
  screenedBy?: string;
  screeningResult?: 'Passed' | 'Failed' | 'Pending';
  screeningEligibility?: 'Eligible' | 'Ineligible' | 'Pending Verification';
  screeningRemarks?: string;
  screening?: {
    status?: 'Screening Pending' | 'Passed' | 'Rejected' | 'Exempted';
    interestLevel?: 'High' | 'Medium' | 'Low';
    willingToRelocate?: boolean;
    careerPreference?: string;
    notes?: string;
    screenedBy?: string;
    screenedDate?: string;
  };

  // Post-Mobilisation Batch & Placement tracking
  trainingStatus?: 'Not Started' | 'Started' | 'In Training' | 'Training Completed' | 'Completed' | 'Dropped' | 'Dropout' | string;
  placementStatus?: 'Pending' | 'Placed' | 'Unplaced' | 'In Process' | string;
  placementEmployer?: string;
  placementSalary?: string;
  placementDate?: string;
  dropoutReason?: string;
  dropoutDate?: string;
  placement?: {
    placementStatus?: 'Unplaced' | 'In Process' | 'Placed' | string;
    employerName?: string;
    designation?: string;
    monthlySalary?: string;
    placementLocation?: string;
    placementDate?: string;
    retentionStatus?: 'Not Started' | '1 Month Completed' | '2 Months Completed' | '3 Months Completed' | 'Left / Dropped' | string;
    retentionNotes?: string;
  };
  
  createdAt: string;
  updatedAt: string;
}

export type ActivityType =
  | 'Community Meeting'
  | 'School Visit'
  | 'College Visit'
  | 'Village Visit'
  | 'Stakeholder Meeting'
  | 'Seminar'
  | 'Awareness Campaign'
  | 'Flyer Distribution'
  | 'Door-to-Door Mobilisation'
  | 'Canvassing / Door-to-Door'
  | 'Job Mela / Placement Drive'
  | 'Counselling'
  | 'Other';

export interface ActivityPhoto {
  id: string;
  activityId: string;
  name: string;
  dataUrl?: string; // base64 encoded photo for offline viewing & local storage
  driveFileId?: string; // Google Drive file ID
  url?: string; // Google Drive web view / download URL
  syncStatus: 'Pending Sync' | 'Syncing' | 'Synced' | 'Sync Failed';
  size?: number;
  errorMessage?: string;
  uploadedAt?: string;
}

export type MobilisationPlanStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Submitted'
  | 'Approved'
  | 'Rejected'
  | 'Sent Back'
  | 'Completed'
  | 'Cancelled';

export interface PlanBudget {
  travelling: number;
  lodging: number;
  fooding: number;
  total: number;
}

export interface MobilisationPlan {
  id: string;
  planId: string; // e.g. MOB-2026-001
  programme: string;
  projectId?: string;
  state: string;
  mobiliserId: string;
  mobiliserName: string;
  district: string;
  block: string;
  location?: string;
  activityType: ActivityType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  plannedBudget: PlanBudget;
  approvedBudget?: PlanBudget;
  status: MobilisationPlanStatus;
  reviewRemarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface MobilisationActivity {
  id: string;
  activityId: string; // ACT-2026-001
  date: string;
  mobiliserId: string;
  mobiliserName: string;
  programme?: string;
  state: string;
  district: string;
  block: string;
  village: string;
  activityType: ActivityType;
  location: string;
  contactPerson: string;
  designation?: string;
  contactNumber: string;
  organisation: string;
  purpose: string;
  participants: number;
  eligibleCandidates: number;
  interestedCandidates: number;
  confirmedCandidates: number;
  candidatesAdded: number;
  expenditure: number;
  isPlanned?: boolean;
  planId?: string; // e.g. MOB-2026-001
  approvedBudget?: PlanBudget;
  actualExpenditureBreakdown?: {
    travelling: number;
    lodging: number;
    fooding: number;
    total: number;
  };
  remarks: string;
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
  photos?: ActivityPhoto[];
  syncStatus?: 'Pending Sync' | 'Syncing' | 'Synced' | 'Sync Failed';
  createdAt: string;
  updatedAt?: string;
}

export type CallOutcome =
  | 'Connected'
  | 'Interested'
  | 'Not Interested'
  | 'Call Later'
  | 'Number Busy'
  | 'Number Not Reachable'
  | 'Wrong Number'
  | 'Confirmed';

export interface CallLog {
  id: string;
  candidateId: string;
  candidateName: string;
  candidatePhone: string;
  candidateDistrict: string;
  mobiliserId: string;
  mobiliserName: string;
  callDate: string;
  callTime: string;
  outcome: CallOutcome;
  notes: string;
  followUpDate?: string;
  followUpRemarks?: string;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  candidateId: string;
  candidateName: string;
  candidatePhone: string;
  candidateDistrict: string;
  candidateStatus: CandidateStatus;
  mobiliserId: string;
  mobiliserName: string;
  followUpDate: string;
  status: 'pending' | 'completed' | 'overdue';
  remarks: string;
  completedAt?: string;
  createdAt: string;
}

export const DDU_GKY_APPLICABLE_DOCUMENTS = [
  'Aadhar Card',
  'Pan Card',
  'Birth Certificate',
  'Ration Card / Job Card / SHG Certificate / RSBY',
  'PRC',
  'Caste Certificate',
  'Marksheet & Admit Card',
  'Passport Photo',
  'Bank Passbook',
  'On-field Registration Form',
  "Parent's Consent Form",
  'Medical Certificate',
] as const;

export const DDU_GKY_MANDATORY_FORMS = [
  'On-field Registration Form',
  "Parent's Consent Form",
] as const;

export const DDU_GKY_MIN_ADDITIONAL_DOCUMENTS = 5;
export const DDU_GKY_MIN_TOTAL_DOCUMENTS = 7;
export const CSR_MIN_REQUIRED_DOCUMENTS = 5;

export const CSR_APPLICABLE_DOCUMENTS = [
  'Aadhar Card',
  'Pan Card',
  'Birth Certificate',
  'Marksheet & Admit Card',
  'Passport Photo',
  'Bank Passbook',
] as const;

export const MIN_REQUIRED_DOCUMENTS_FOR_TRANSITION = 7;

export type DduGkyDocumentType = (typeof DDU_GKY_APPLICABLE_DOCUMENTS)[number];
export type CsrDocumentType = (typeof CSR_APPLICABLE_DOCUMENTS)[number];

export function getApplicableDocumentsForProject(project?: string): string[] {
  if (!project) return [...DDU_GKY_APPLICABLE_DOCUMENTS];
  const p = project.toUpperCase();
  if (p.includes('CSR')) {
    return [...CSR_APPLICABLE_DOCUMENTS];
  }
  return [...DDU_GKY_APPLICABLE_DOCUMENTS];
}

export function normalizeDocumentName(docName: string): string {
  if (!docName) return '';
  const lower = docName.toLowerCase().trim();
  if (
    lower.includes('on-field') ||
    lower.includes('on field') ||
    (lower.includes('registration') && lower.includes('form'))
  ) {
    return 'On-field Registration Form';
  }
  if (lower.includes('parent') || lower.includes('consent')) {
    return "Parent's Consent Form";
  }
  if (lower.includes('medical')) {
    return 'Medical Certificate';
  }
  if (lower.includes('aadhaar') || lower.includes('aadhar')) return 'Aadhar Card';
  if (lower.includes('pan card') || lower === 'pan') return 'Pan Card';
  if (lower.includes('birth')) return 'Birth Certificate';
  if (
    lower.includes('ration') ||
    lower.includes('job card') ||
    lower.includes('shg') ||
    lower.includes('rsby')
  ) {
    return 'Ration Card / Job Card / SHG Certificate / RSBY';
  }
  if (lower === 'prc' || lower.includes('permanent resident')) return 'PRC';
  if (lower.includes('caste')) return 'Caste Certificate';
  if (
    lower.includes('marksheet') ||
    lower.includes('admit') ||
    lower.includes('education certificate')
  ) {
    return 'Marksheet & Admit Card';
  }
  if (lower.includes('photo') || lower.includes('photograph') || lower.includes('passport')) {
    return 'Passport Photo';
  }
  if (lower.includes('bank') || lower.includes('passbook')) return 'Bank Passbook';
  return docName;
}

export interface DocumentTransitionCheckResult {
  canTransition: boolean;
  collectedCount: number;
  requiredCount: number;
  collectedDocuments: string[];
  missingDocuments: string[];
  applicableDocuments: string[];
  project: string;
  isDduGky: boolean;
  hasOnFieldForm: boolean;
  hasParentConsent: boolean;
  mandatoryMissing: string[];
  missingMandatoryForms: string[];
  additionalCount: number;
  requiredAdditionalCount: number;
  additionalMissingCount: number;
  summaryMessage: string;
  detailedRequirements: string[];
}

export function evaluateDocumentTransition(
  project: string,
  collectedDocsInput: string[]
): DocumentTransitionCheckResult {
  const proj = project || 'DDU-GKY 2.0';
  const applicable = getApplicableDocumentsForProject(proj);
  const normalizedCollected = Array.from(
    new Set(collectedDocsInput.map((d) => normalizeDocumentName(d)).filter(Boolean))
  );
  const validCollected = applicable.filter((d) => normalizedCollected.includes(d));
  const missing = applicable.filter((d) => !validCollected.includes(d));
  const count = validCollected.length;

  const isCsr = proj.toUpperCase().includes('CSR');

  if (isCsr) {
    const requiredCount = CSR_MIN_REQUIRED_DOCUMENTS; // 5
    const canTransition = count >= requiredCount;
    const detailedRequirements: string[] = [];
    if (!canTransition) {
      detailedRequirements.push(
        `At least ${requiredCount} documents required for CSR (${requiredCount - count} more needed)`
      );
    }
    return {
      canTransition,
      collectedCount: count,
      requiredCount,
      collectedDocuments: validCollected,
      missingDocuments: missing,
      applicableDocuments: applicable,
      project: proj,
      isDduGky: false,
      hasOnFieldForm: true,
      hasParentConsent: true,
      mandatoryMissing: [],
      missingMandatoryForms: [],
      additionalCount: count,
      requiredAdditionalCount: requiredCount,
      additionalMissingCount: Math.max(0, requiredCount - count),
      summaryMessage: canTransition
        ? `CSR document requirement satisfied (${count} of ${requiredCount} collected).`
        : `CSR requires at least ${requiredCount} documents (${count}/${requiredCount} collected).`,
      detailedRequirements,
    };
  }

  // DDU-GKY Transition Rule:
  // 1. On-field Registration Form is collected
  // 2. Parent's Consent Form is collected
  // 3. At least 5 additional DDU-GKY documents are collected
  // Total minimum: 7 documents
  const hasOnFieldForm = validCollected.includes('On-field Registration Form');
  const hasParentConsent = validCollected.includes("Parent's Consent Form");
  const mandatoryMissing: string[] = [];
  if (!hasOnFieldForm) mandatoryMissing.push('On-field Registration Form');
  if (!hasParentConsent) mandatoryMissing.push("Parent's Consent Form");

  const additionalCollected = validCollected.filter(
    (d) => d !== 'On-field Registration Form' && d !== "Parent's Consent Form"
  );
  const additionalCount = additionalCollected.length;
  const requiredAdditionalCount = DDU_GKY_MIN_ADDITIONAL_DOCUMENTS; // 5
  const additionalMissingCount = Math.max(0, requiredAdditionalCount - additionalCount);

  const canTransition =
    hasOnFieldForm && hasParentConsent && additionalCount >= requiredAdditionalCount;

  const detailedRequirements: string[] = [];
  if (!hasOnFieldForm) {
    detailedRequirements.push('On-field Registration Form is missing (Mandatory)');
  }
  if (!hasParentConsent) {
    detailedRequirements.push("Parent's Consent Form is missing (Mandatory)");
  }
  if (additionalMissingCount > 0) {
    detailedRequirements.push(
      `At least 5 additional documents required (currently ${additionalCount} of 5 collected; ${additionalMissingCount} more needed)`
    );
  }

  let summaryMessage = '';
  if (canTransition) {
    summaryMessage = `DDU-GKY requirements satisfied: 2 mandatory forms + ${additionalCount} additional documents (${count} total). Ready for Post-Mobilisation.`;
  } else {
    const reasons: string[] = [];
    if (mandatoryMissing.length > 0) {
      reasons.push(`Mandatory form(s) missing: ${mandatoryMissing.join(' and ')}`);
    }
    if (additionalMissingCount > 0) {
      reasons.push(`${additionalMissingCount} more additional document(s) required`);
    }
    summaryMessage = `Post-Mobilisation blocked: ${reasons.join('; ')} (Total collected: ${count}/7 minimum).`;
  }

  return {
    canTransition,
    collectedCount: count,
    requiredCount: DDU_GKY_MIN_TOTAL_DOCUMENTS, // 7
    collectedDocuments: validCollected,
    missingDocuments: missing,
    applicableDocuments: applicable,
    project: proj,
    isDduGky: true,
    hasOnFieldForm,
    hasParentConsent,
    mandatoryMissing,
    missingMandatoryForms: mandatoryMissing,
    additionalCount,
    requiredAdditionalCount,
    additionalMissingCount,
    summaryMessage,
    detailedRequirements,
  };
}

export type DocumentType =
  | 'Aadhar Card'
  | 'Pan Card'
  | 'Birth Certificate'
  | 'Ration Card / Job Card / SHG Certificate / RSBY'
  | 'PRC'
  | 'Caste Certificate'
  | 'Marksheet & Admit Card'
  | 'Passport Photo'
  | 'Bank Passbook'
  | 'On-field Registration Form'
  | "Parent's Consent Form"
  | 'Medical Certificate'
  // Backward compatibility aliases:
  | 'Ration Card/Job Card/SHG Certificate/RSBY'
  | 'Aadhaar'
  | 'Photograph'
  | 'Education Certificate'
  | 'Bank Document'
  | 'Bank Details'
  | 'Address Proof'
  | 'Caste/Income Certificate'
  | 'Other';

export type DocumentVerificationStatus = 'Pending' | 'Uploaded' | 'Verified' | 'Rejected';

export interface CandidateDocument {
  id: string;
  candidateId: string;
  candidateName?: string;
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  status: DocumentVerificationStatus;
  uploadedBy: string;
  uploadedAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  driveFileId?: string;
  fileSize?: number;
  mimeType?: string;
  base64Content?: string;
  syncStatus?: 'Pending Sync' | 'Syncing' | 'Synced' | 'Sync Failed';
}

export interface StatusHistory {
  id: string;
  candidateId: string;
  oldStatus: CandidateStatus | 'None';
  newStatus: CandidateStatus;
  oldStage?: CandidateStage | 'None';
  newStage?: CandidateStage;
  changedBy: string;
  remarks: string;
  createdAt: string;
}

export interface District {
  id: string;
  stateId: string;
  stateName: string;
  name: string;
  target: number;
  blocks: string[];
}

export const STANDARD_YEAR_OPTIONS = [
  '2024-25',
  '2025-26',
  '2026-27',
  '2027-28',
  '2028-29',
  '2029-30',
  '2030-31',
] as const;
export type StandardYearOption = (typeof STANDARD_YEAR_OPTIONS)[number];

export interface Project {
  id: string;
  name: string;
  state: string; // e.g. 'Assam', 'Meghalaya', 'Nagaland', 'Manipur', 'All States'
  year: string; // e.g. '2026-27'
  phase?: string; // e.g. 'Phase 1'
  cycle?: string; // e.g. 'Cycle 1'
  phases: string[]; // e.g. ['Phase 1', 'Phase 2', 'Phase 3']
  cycles: string[]; // e.g. ['Cycle 1', 'Cycle 2', 'Cycle 3']
  startDate?: string;
  endDate?: string;
  status: 'Active' | 'Completed' | 'Upcoming';
  target: number;
  description?: string; // Optional/legacy
}

export interface Batch {
  id: string;
  projectId: string;
  projectName?: string;
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  status: 'Admissions Open' | 'Ongoing' | 'Completed';
  district: string;
}

export interface TargetConfig {
  id: string;
  target: number;
  period: string; // e.g. "September 2026"
  type: 'mobiliser' | 'district' | 'project' | 'monthly';
  entityId: string; // mobiliserId or districtId or projectId
  entityName: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  linkTab?: string;
  read: boolean;
  createdAt: string;
}

export interface OfflineSyncItem {
  id: string;
  action: 'create_candidate' | 'update_candidate' | 'log_call' | 'add_activity' | 'complete_followup' | 'upload_document' | 'update_status';
  payload: any;
  timestamp: number;
  description: string;
}
