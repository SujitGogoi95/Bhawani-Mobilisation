import React, { useState, useMemo, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  Filter,
  Users,
  Building2,
  Sparkles,
} from 'lucide-react';
import { dataStore } from '../services/dataStore';
import { FieldMobiliser, User as UserType } from '../types';
import { getDistrictsForState } from '../utils/locationData';

interface MobiliserManagementViewProps {
  currentUser: UserType;
}

const SUPPORTED_STATES = ['Nagaland', 'Assam', 'Meghalaya', 'Manipur'] as const;

export const MobiliserManagementView: React.FC<MobiliserManagementViewProps> = ({ currentUser }) => {
  const [activeStateTab, setActiveStateTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [storeVersion, setStoreVersion] = useState(0);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMobiliser, setEditingMobiliser] = useState<FieldMobiliser | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formState, setFormState] = useState<string>('Nagaland');
  const [formDistrict, setFormDistrict] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formTarget, setFormTarget] = useState<number>(50);
  const [formError, setFormError] = useState<string | null>(null);

  // In-app Delete Confirmation (no window.confirm)
  const [mobiliserToDelete, setMobiliserToDelete] = useState<FieldMobiliser | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dataStore.subscribe(() => setStoreVersion((v) => v + 1));
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Available districts for the state chosen in the modal
  const modalDistricts = useMemo(() => {
    return getDistrictsForState(formState);
  }, [formState]);

  // Fetch all mobilisers
  const allMobilisers = useMemo(() => {
    return dataStore.getFieldMobilisers(undefined, false);
  }, [storeVersion]);

  // Mobilisers filtered by tab and search
  const filteredMobilisers = useMemo(() => {
    return allMobilisers.filter((m) => {
      if (activeStateTab !== 'All' && m.state.toLowerCase() !== activeStateTab.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesPhone = m.phone ? m.phone.toLowerCase().includes(q) : false;
        const matchesState = m.state.toLowerCase().includes(q);
        const matchesDistrict = m.district ? m.district.toLowerCase().includes(q) : false;
        return matchesName || matchesPhone || matchesState || matchesDistrict;
      }
      return true;
    });
  }, [allMobilisers, activeStateTab, searchQuery]);

  // Counts by state
  const stateCounts = useMemo(() => {
    const counts: Record<string, { total: number; active: number }> = {
      All: { total: allMobilisers.length, active: allMobilisers.filter((m) => m.status === 'active').length },
      Nagaland: { total: 0, active: 0 },
      Assam: { total: 0, active: 0 },
      Meghalaya: { total: 0, active: 0 },
      Manipur: { total: 0, active: 0 },
    };

    allMobilisers.forEach((m) => {
      if (counts[m.state]) {
        counts[m.state].total += 1;
        if (m.status === 'active') {
          counts[m.state].active += 1;
        }
      }
    });
    return counts;
  }, [allMobilisers]);

  const handleOpenAddModal = (defaultState?: string) => {
    setEditingMobiliser(null);
    setFormName('');
    const st = defaultState && defaultState !== 'All' ? defaultState : activeStateTab !== 'All' ? activeStateTab : 'Nagaland';
    setFormState(st);
    const dists = getDistrictsForState(st);
    setFormDistrict(dists[0] || '');
    setFormPhone('');
    setFormEmail('');
    setFormStatus('active');
    setFormTarget(50);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mob: FieldMobiliser) => {
    setEditingMobiliser(mob);
    setFormName(mob.name);
    setFormState(mob.state);
    setFormDistrict(mob.district || '');
    setFormPhone(mob.phone || '');
    setFormEmail(mob.email || '');
    setFormStatus(mob.status);
    setFormTarget(mob.monthlyTarget || 50);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveMobiliser = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('Mobiliser Name is required.');
      return;
    }

    const cleanPhone = formPhone.replace(/\D/g, '');
    if (cleanPhone && cleanPhone.length !== 10) {
      setFormError('Contact Number must be a valid 10-digit phone number.');
      return;
    }

    try {
      if (editingMobiliser) {
        dataStore.updateFieldMobiliser(
          editingMobiliser.id,
          {
            name: trimmedName,
            state: formState,
            district: formDistrict || undefined,
            phone: cleanPhone || undefined,
            email: formEmail.trim() || undefined,
            status: formStatus,
            monthlyTarget: Number(formTarget) || 50,
          },
          currentUser.name
        );
        showToast(`Successfully updated mobiliser "${trimmedName}".`);
      } else {
        dataStore.addFieldMobiliser(
          {
            name: trimmedName,
            state: formState,
            district: formDistrict || undefined,
            phone: cleanPhone || undefined,
            email: formEmail.trim() || undefined,
            status: formStatus,
            monthlyTarget: Number(formTarget) || 50,
          },
          currentUser.name
        );
        showToast(`Successfully added "${trimmedName}" under ${formState}.`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save mobiliser.');
    }
  };

  const handleToggleStatus = (mob: FieldMobiliser) => {
    try {
      dataStore.toggleFieldMobiliserStatus(mob.id, currentUser.name);
      const nextStatus = mob.status === 'active' ? 'deactivated' : 'activated';
      showToast(`Mobiliser "${mob.name}" has been ${nextStatus}.`);
    } catch (err: any) {
      showToast(err.message || 'Action failed');
    }
  };

  const handleConfirmDelete = () => {
    if (!mobiliserToDelete) return;
    try {
      const name = mobiliserToDelete.name;
      dataStore.deleteFieldMobiliser(mobiliserToDelete.id, currentUser.name);
      showToast(`Mobiliser "${name}" has been permanently removed.`);
      setMobiliserToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete mobiliser');
      setMobiliserToDelete(null);
    }
  };

  // Guard: Admin-only view
  if (currentUser.role !== 'admin') {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          The Mobiliser Master list is maintained exclusively by Amit Sinha (Admin). Field mobilisers select their names during candidate registration.
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
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900">Mobiliser Master List</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Admin Controlled
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Maintain field mobilisers by state. These names appear in the Candidate Registration dropdown.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Mobiliser</span>
          </button>
        </div>
      </div>

      {/* State Tabs & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* State Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveStateTab('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeStateTab === 'All'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All States ({stateCounts.All.total})
            </button>
            {SUPPORTED_STATES.map((st) => {
              const info = stateCounts[st] || { total: 0, active: 0 };
              const isSelected = activeStateTab === st;
              return (
                <button
                  key={st}
                  onClick={() => setActiveStateTab(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{st}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {info.total}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobilisers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredMobilisers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No mobilisers found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No mobilisers match your search query.'
                : `No mobilisers have been added for ${activeStateTab === 'All' ? 'any state' : activeStateTab} yet.`}
            </p>
            <button
              onClick={() => handleOpenAddModal(activeStateTab)}
              className="mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Mobiliser</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Mobiliser Name</th>
                  <th className="py-3 px-4">Assigned State</th>
                  <th className="py-3 px-4">District / Area</th>
                  <th className="py-3 px-4">Contact Number</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredMobilisers.map((mob, idx) => {
                  const isActive = mob.status === 'active';
                  return (
                    <tr key={`mob-mgmt-${mob.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {mob.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{mob.name}</div>
                            <div className="text-[10px] font-mono text-slate-400">{mob.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {mob.state}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-600 font-medium">
                          {mob.district || 'General Coverage'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {mob.phone ? (
                          <div className="flex items-center gap-1.5 font-mono text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{mob.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Not provided</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(mob)}
                          title={`Click to ${isActive ? 'deactivate' : 'activate'}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span>{isActive ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(mob)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Edit Mobiliser Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setMobiliserToDelete(mob)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete Mobiliser Name"
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

      {/* Add / Edit Mobiliser Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {editingMobiliser ? 'Modify Mobiliser Details' : 'Add New Field Mobiliser'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Admin Managed • Synchronized with Candidate Registration
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMobiliser} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobiliser Name *
                </label>
                <input
                  required
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Mobiliser A, John Jamir..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  This exact name will be selectable by field staff during candidate registration.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    State Assignment *
                  </label>
                  <select
                    value={formState}
                    onChange={(e) => {
                      const newSt = e.target.value;
                      setFormState(newSt);
                      const dists = getDistrictsForState(newSt);
                      setFormDistrict(dists[0] || '');
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white"
                  >
                    {SUPPORTED_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    District / Base
                  </label>
                  <select
                    value={formDistrict}
                    onChange={(e) => setFormDistrict(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white"
                  >
                    <option value="">General / All Districts</option>
                    {modalDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Registered Contact Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="10-digit mobile number (e.g. 9862000000)"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:bg-white focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Auto-populates when the mobiliser selects their name during candidate registration.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Account Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white"
                  >
                    <option value="active">Active (Visible in dropdown)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Monthly Target
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={formTarget}
                    onChange={(e) => setFormTarget(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {editingMobiliser ? 'Save Changes' : 'Add Mobiliser'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal (Guaranteed to work in iframes without window.confirm) */}
      {mobiliserToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Remove Mobiliser Name</h3>
                <p className="text-xs text-slate-500">{mobiliserToDelete.state} State List</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove <strong className="text-slate-900 font-bold">{mobiliserToDelete.name}</strong> from the Mobiliser Master?
              They will no longer appear in the candidate registration dropdown.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setMobiliserToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
