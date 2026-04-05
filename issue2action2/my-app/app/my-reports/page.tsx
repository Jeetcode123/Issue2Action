"use client";

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FileText, Clock, CheckCircle, AlertCircle, MapPin, Search, Filter, Mail, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getUserIssues, UserIssue } from '@/lib/api';
import { getAuth } from '@/lib/auth';
import { StatusBadge } from '@/components/StatusBadge';

// Removed mockReports

export default function MyReportsPage() {
  const [reports, setReports] = useState<UserIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const { userId } = getAuth();
        if (userId) {
           const data = await getUserIssues(userId);
           setReports(data || []);
        } else {
           setError('Please log in to view your reports.');
        }
      } catch (err: any) {
        console.error("Failed to fetch reports:", err);
        setError('Failed to load your reports. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, []);

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      report.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || report.status === statusFilter;
    const matchesCategory = !categoryFilter || report.type === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = Array.from(new Set(reports.map(r => r.type).filter(Boolean)));

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#0d1627] dark:text-white tracking-tight font-display">My Reports</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Track the status of issues you've reported.</p>
          </div>
          <Link href="/report" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-[0_4px_14px_rgba(37,99,235,0.3)] flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0">
            <FileText className="w-4.5 h-4.5" />
            New Report
          </Link>
        </div>

        {/* Filters & Search */}
        {!error && !isLoading && reports.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/50 dark:bg-[#1e293b]/50 p-4 rounded-2xl backdrop-blur-sm border border-white dark:border-gray-700 shadow-sm">
            <div className="md:col-span-2 relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input 
                 type="text" 
                 placeholder="Search by title, ID, or description..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all dark:text-white"
               />
            </div>
            <div className="relative">
               <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
               <select 
                 value={statusFilter}
                 onChange={(e) => setStatusFilter(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none dark:text-white"
               >
                 <option value="">All Statuses</option>
                 <option value="reported">Reported</option>
                 <option value="verified">Verified</option>
                 <option value="assigned">Assigned</option>
                 <option value="in_progress">In Progress</option>
                 <option value="resolved">Resolved</option>
                 <option value="closed">Closed</option>
               </select>
            </div>
            <div className="relative">
               <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
               <select 
                 value={categoryFilter}
                 onChange={(e) => setCategoryFilter(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none dark:text-white"
               >
                 <option value="">All Categories</option>
                 {categories.map(cat => (
                   <option key={cat as string} value={cat as string}>{cat as string}</option>
                 ))}
               </select>
            </div>
          </div>
        )}

        {error ? (
          <div className="text-center py-16 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/50 rounded-2xl backdrop-blur-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">Error Loading Reports</h3>
            <p className="text-red-600 dark:text-red-500 mt-1">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-[#1e293b]/70 border border-gray-100 dark:border-gray-700 rounded-2xl h-32 animate-pulse" />
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-20 bg-white/50 dark:bg-[#1e293b]/50 border border-gray-100 dark:border-gray-700 rounded-3xl backdrop-blur-md">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">No reports found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">
              {searchQuery || statusFilter || categoryFilter 
                ? "No reports match your current search or filter criteria." 
                : "It looks like you haven't reported any issues yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5">
            {filteredReports.map((report) => (
              <div key={report.id} className="bg-white/80 dark:bg-[#1e293b]/80 border border-white dark:border-gray-700 rounded-2xl p-5 md:p-6 transition-all hover:shadow-lg hover:border-blue-100 dark:hover:border-blue-900 backdrop-blur-md relative overflow-hidden group">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Status & Priority Side */}
                  <div className="md:w-48 shrink-0 flex flex-col gap-4">
                    <StatusBadge status={report.status} className="w-full justify-center py-2 text-xs" />
                    
                    <div className="flex flex-col gap-1.5 px-1">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Ticket ID</span>
                      <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/50 px-2 py-1 rounded">
                        {report.id}
                      </span>
                    </div>

                    {report.authority_notified && (
                      <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-[11px] font-bold uppercase tracking-tight">System Dispatched</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Authority has been notified via email.</p>
                      </div>
                    )}
                  </div>

                  {/* Content Side */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="mb-4">
                      <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {report.title || (`${report.type || 'Civic'} Complaint`)}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed line-clamp-3">
                        {report.description || 'Detailed information is available in the tracking view.'}
                      </p>
                    </div>

                    <div className="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/50">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="truncate">{report.location_text || report.ward || 'Location specified on map'}</span>
                      </div>
                      
                      <Link 
                        href={`/track?id=${report.id}`} 
                        className="flex items-center justify-between text-white bg-[#0f172a] dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 p-2.5 rounded-xl transition-all shadow-sm group/btn"
                      >
                        <span className="text-xs font-bold pl-1">TRACK PROGRESS</span>
                        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
