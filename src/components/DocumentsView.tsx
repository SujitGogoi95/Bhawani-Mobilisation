import React, { useState, useMemo } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Upload,
  User,
  Filter,
  Check,
  X,
  ShieldCheck,
  FileCheck,
  ExternalLink,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import {
  CandidateDocument,
  DocumentType,
  DocumentVerificationStatus,
  User as UserType,
  DDU_GKY_APPLICABLE_DOCUMENTS,
  DDU_GKY_MANDATORY_FORMS,
  getApplicableDocumentsForProject,
  normalizeDocumentName,
} from '../types';

interface DocumentsViewProps {
  currentUser: UserType;
  onSelectCandidate: (candidateId: string) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  currentUser,
  onSelectCandidate,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload Form
  const candidates = dataStore.getCandidates(currentUser);
  const [uploadCandidateId, setUploadCandidateId] = useState(candidates[0]?.id || '');
  const selectedCandidate = candidates.find((c) => c.id === uploadCandidateId);
  const selectedCandProject =
    selectedCandidate?.project ||
    selectedCandidate?.projectName ||
    selectedCandidate?.programme ||
    'DDU-GKY 2.0';

  const applicableForSelectedCand = useMemo(
    () => getApplicableDocumentsForProject(selectedCandProject),
    [selectedCandProject]
  );

  const [uploadDocType, setUploadDocType] = useState<string>('On-field Registration Form');

  const documents = dataStore.getDocuments(undefined, currentUser);

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (selectedStatus !== 'All' && d.status !== selectedStatus) return false;
      if (selectedType !== 'All') {
        const normSelected = normalizeDocumentName(selectedType);
        const normDoc = normalizeDocumentName(d.documentType);
        if (normDoc !== normSelected && d.documentType !== selectedType) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          d.candidateName.toLowerCase().includes(q) ||
          d.fileName.toLowerCase().includes(q) ||
          (d.candidateId && d.candidateId.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [documents, selectedStatus, selectedType, searchQuery]);

  const handleVerify = (docId: string, status: DocumentVerificationStatus) => {
    let reason: string | undefined;
    if (status === 'Rejected') {
      reason = prompt('Please enter rejection reason (e.g., Unclear scan, Name mismatch):') || 'Rejected during document check';
    }
    dataStore.verifyDocument(docId, status, reason);
  };

  const handleSimulateUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadCandidateId) return;

    const cand = candidates.find((c) => c.id === uploadCandidateId);
    if (!cand) return;

    dataStore.uploadDocument({
      candidateId: cand.id,
      documentType: uploadDocType,
      fileName: `${uploadDocType.toLowerCase().replace(/\s+/g, '_')}_${cand.candidateId}.pdf`,
    });

    setShowUploadModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Candidate Document Verification Desk</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Synchronized Master Document List (12 DDU-GKY Documents) • Same Master as Student Registration
          </p>
        </div>

        <button
          onClick={() => {
            const initialCand = candidates[0];
            setUploadCandidateId(initialCand?.id || '');
            const proj = initialCand?.project || initialCand?.projectName || initialCand?.programme || 'DDU-GKY 2.0';
            const docs = getApplicableDocumentsForProject(proj);
            setUploadDocType(docs[0] || 'On-field Registration Form');
            setShowUploadModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <label className="font-bold text-slate-500 uppercase text-[10px] mr-1.5">Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Uploaded">Uploaded (Awaiting Review)</option>
              <option value="Verified">Verified ✓</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-500 uppercase text-[10px] mr-1.5">Document Type:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-md font-medium"
            >
              <option value="All">All Document Types ({DDU_GKY_APPLICABLE_DOCUMENTS.length} Master Documents)</option>
              <optgroup label="12 DDU-GKY Master Documents">
                {DDU_GKY_APPLICABLE_DOCUMENTS.map((docName) => (
                  <option key={docName} value={docName}>
                    {docName} {(DDU_GKY_MANDATORY_FORMS as readonly string[]).includes(docName) ? '(Mandatory)' : ''}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, ID, or file..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Documents Grid / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-xl border border-dashed border-slate-300">
            <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No documents found matching filters.</p>
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const normDocName = normalizeDocumentName(doc.documentType) || doc.documentType;
            const isMandatory = (DDU_GKY_MANDATORY_FORMS as readonly string[]).includes(normDocName);
            return (
              <div
                key={doc.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded truncate max-w-[200px]">
                          {normDocName}
                        </span>
                        {isMandatory && (
                          <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            Mandatory Form
                          </span>
                        )}
                      </div>
                      <h3
                        onClick={() => onSelectCandidate(doc.candidateId)}
                        className="text-sm font-bold text-slate-900 mt-1 hover:text-indigo-600 cursor-pointer truncate"
                      >
                        {doc.candidateName}
                      </h3>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        doc.status === 'Verified'
                          ? 'bg-emerald-100 text-emerald-800'
                          : doc.status === 'Uploaded'
                          ? 'bg-sky-100 text-sky-800'
                          : doc.status === 'Rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                    <p className="font-mono text-[11px] text-slate-700 truncate">{doc.fileName}</p>
                    <p className="text-[10px]">
                      Uploaded on {doc.uploadedAt ? doc.uploadedAt.split('T')[0] : 'Recently'} by{' '}
                      {doc.uploadedBy || 'System'}
                    </p>
                    {doc.verifiedBy && (
                      <p className="text-[10px] text-emerald-700 font-semibold">
                        Verified by {doc.verifiedBy} on {doc.verifiedAt ? doc.verifiedAt.split('T')[0] : ''}
                      </p>
                    )}
                    {doc.rejectionReason && (
                      <p className="text-[11px] text-rose-600 font-semibold">
                        Rejection: {doc.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                  {currentUser.role !== 'mobiliser' && doc.status === 'Uploaded' && (
                    <>
                      <button
                        onClick={() => handleVerify(doc.id, 'Verified')}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Verify</span>
                      </button>
                      <button
                        onClick={() => handleVerify(doc.id, 'Rejected')}
                        className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      title="Open restricted document in Google Drive"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Drive File</span>
                    </a>
                  )}

                  <button
                    onClick={() => onSelectCandidate(doc.candidateId)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer ml-auto"
                  >
                    View Candidate
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleSimulateUpload}
            className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Upload Candidate Document</h4>
                <p className="text-[11px] text-slate-500">
                  Shared Document Master • Synchronized with Candidate Record
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Candidate *</label>
              <select
                value={uploadCandidateId}
                onChange={(e) => {
                  const newCandId = e.target.value;
                  setUploadCandidateId(newCandId);
                  const cObj = candidates.find((c) => c.id === newCandId);
                  const p = cObj?.project || cObj?.projectName || cObj?.programme || 'DDU-GKY 2.0';
                  const pDocs = getApplicableDocumentsForProject(p);
                  setUploadDocType(pDocs[0] || 'On-field Registration Form');
                }}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.candidateId}) — {c.project || 'DDU-GKY 2.0'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Document Type *</label>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {selectedCandProject} ({applicableForSelectedCand.length} Master Documents)
                </span>
              </div>
              <select
                value={uploadDocType}
                onChange={(e) => setUploadDocType(e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
              >
                <optgroup label={`${selectedCandProject} Master Documents`}>
                  {applicableForSelectedCand.map((docName) => (
                    <option key={docName} value={docName}>
                      {docName} {(DDU_GKY_MANDATORY_FORMS as readonly string[]).includes(docName) ? '(Mandatory Form)' : ''}
                    </option>
                  ))}
                </optgroup>
                {selectedCandProject !== 'DDU-GKY 2.0' && (
                  <optgroup label="Other DDU-GKY Master Documents">
                    {DDU_GKY_APPLICABLE_DOCUMENTS.filter((d) => !applicableForSelectedCand.includes(d)).map((docName) => (
                      <option key={docName} value={docName}>
                        {docName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50">
              <Upload className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">Choose file or take camera photo</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF, JPG, PNG up to 5MB</p>
              <p className="text-[10px] text-indigo-600 font-medium mt-1">
                Updates candidate record for ID: {selectedCandidate?.candidateId || uploadCandidateId}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
              >
                Upload Document
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
