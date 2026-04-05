"use client";

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Shield, Plus, Loader2, Edit2, Trash2, PowerOff, Power } from 'lucide-react';
import { Authority, getAuthorities, createAuthority, updateAuthority, deleteAuthority } from '@/lib/api';

export default function AuthoritiesPage() {
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAuth, setEditingAuth] = useState<Authority | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Authority>>({
     name: '',
     department: '',
     locality: '',
     issue_type: '',
     email: '',
     phone: '',
     priority_level: 1,
     is_active: true
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getAuthorities();
      setAuthorities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = authorities.filter(a => 
    a.department.toLowerCase().includes(search.toLowerCase()) || 
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    (a.name && a.name.toLowerCase().includes(search.toLowerCase())) ||
    (a.locality && a.locality.toLowerCase().includes(search.toLowerCase()))
  );

  const openModal = (auth: Authority | null = null) => {
     if (auth) {
        setEditingAuth(auth);
        setFormData(auth);
     } else {
        setEditingAuth(null);
        setFormData({
           name: '',
           department: '',
           locality: '',
           issue_type: '',
           email: '',
           phone: '',
           priority_level: 1,
           is_active: true
        });
     }
     setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
     e.preventDefault();
     setFormLoading(true);
     try {
       if (editingAuth) {
         await updateAuthority(editingAuth.id, formData);
       } else {
         await createAuthority(formData);
       }
       await fetchData();
       setIsModalOpen(false);
     } catch (err) {
       console.error(err);
       alert("Failed to save authority.");
     } finally {
       setFormLoading(false);
     }
  };

  const handleDelete = async (id: string) => {
     if (!confirm("Are you sure you want to delete this authority record?")) return;
     try {
        await deleteAuthority(id);
        await fetchData();
     } catch (err) {
        alert("Failed to delete authority.");
     }
  };

  const toggleActive = async (auth: Authority) => {
     try {
       await updateAuthority(auth.id, { is_active: !auth.is_active });
       await fetchData();
     } catch (err) {
       console.error("Failed to toggle status", err);
     }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-500" />
              Civic Authorities Directory
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage dispatch endpoints and intelligent email routing logic.</p>
          </div>
          <button 
             onClick={() => openModal()}
             className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
             <Plus className="w-5 h-5" /> Add Authority
          </button>
        </div>

        <div className="bg-white dark:bg-[#1e293b]/70 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
           <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <input 
                 type="text" 
                 placeholder="Search by department, email, or locality..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="w-full max-w-md px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-[#0f172a]/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              />
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="bg-gray-50 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400 font-medium">
                  <tr>
                     <th className="px-6 py-4">Name & Dept</th>
                     <th className="px-6 py-4">Locality / Issue Target</th>
                     <th className="px-6 py-4">Contact</th>
                     <th className="px-6 py-4">Priority</th>
                     <th className="px-6 py-4">Status</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                         <div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                         No authority records match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map(auth => (
                      <tr key={auth.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                         <td className="px-6 py-4">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{auth.name || 'Anonymous Desk'}</div>
                            <div className="text-xs text-gray-500">{auth.department}</div>
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                               <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  📍 {auth.locality || 'Any Ward (Global)'}
                               </span>
                               <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  🚨 {auth.issue_type || 'Any Issue'}
                               </span>
                            </div>
                         </td>
                         <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                            <div>{auth.email}</div>
                            {auth.phone && <div className="text-xs">{auth.phone}</div>}
                         </td>
                         <td className="px-6 py-4">
                            <span className="bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-md font-mono text-xs text-gray-700 dark:text-gray-300">
                               lvl {auth.priority_level}
                            </span>
                         </td>
                         <td className="px-6 py-4">
                            <button 
                               onClick={() => toggleActive(auth)}
                               className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 transition-colors ${auth.is_active ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-400' : 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400'}`}
                            >
                               {auth.is_active ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                               {auth.is_active ? 'Active' : 'Disabled'}
                            </button>
                         </td>
                         <td className="px-6 py-4 text-right space-x-2">
                             <button onClick={() => openModal(auth)} className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors inline-block">
                                <Edit2 className="w-4 h-4" />
                             </button>
                             <button onClick={() => handleDelete(auth.id)} className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors inline-block">
                                <Trash2 className="w-4 h-4" />
                             </button>
                         </td>
                      </tr>
                    ))
                  )}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {isModalOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in cursor-default">
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
               <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/30">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {editingAuth ? 'Update Authority Record' : 'Create New Authority'}
                  </h2>
               </div>
               <form onSubmit={handleSave} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Point of Contact / Name</label>
                        <input required type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="e.g. John Doe, Transport Desk" />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department <span className="text-red-500">*</span></label>
                        <input required type="text" value={formData.department || ''} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="e.g. Public Works, Sanitation" />
                     </div>
                     <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Profile <span className="text-red-500">*</span></label>
                        <input required type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="authority@city.gov" />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number (Optional)</label>
                        <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="+1..." />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority Target Level</label>
                        <input type="number" min="1" max="10" value={formData.priority_level || 1} onChange={e => setFormData({...formData, priority_level: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
                     </div>
                     <div className="col-span-2 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Smart Routing Modifiers</h4>
                        <p className="text-xs text-gray-500">Leaving these blank means this authority will act as a fallback logic handler for the department globally.</p>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Strict Ward / Locality</label>
                              <input type="text" value={formData.locality || ''} onChange={e => setFormData({...formData, locality: e.target.value})} className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0f172a] text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="e.g. Ward A" />
                           </div>
                           <div>
                              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Strict Issue Type Match</label>
                              <select 
                                 value={formData.issue_type || ''} 
                                 onChange={e => setFormData({...formData, issue_type: e.target.value})} 
                                 className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0f172a] text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              >
                                 <option value="">Any Issue (Global)</option>
                                 <option value="Road">Road</option>
                                 <option value="Water">Water</option>
                                 <option value="Garbage">Garbage</option>
                                 <option value="Electric">Electric</option>
                                 <option value="Sewer">Sewer</option>
                              </select>
                           </div>
                        </div>
                     </div>
                     <div className="col-span-2 flex items-center justify-between mt-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Authority Dispatch Engine Enabled</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                     </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                     <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                        Cancel
                     </button>
                     <button type="submit" disabled={formLoading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-2">
                        {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Authority
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </DashboardLayout>
  );
}
