'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getPublicIssues } from '@/lib/api';

// Dynamically import MapView to disable SSR for react-leaflet
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50/50 dark:bg-[#0a0f1e]/50 backdrop-blur-sm">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-500 dark:text-gray-400 font-medium">Loading Map...</p>
    </div>
  ),
});

const filters = ['All', 'Road', 'Water', 'Garbage', 'Electric', 'Lights'];

// Helper for time ago
function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
}

const getCategoryIcon = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'road': return '🛣️';
    case 'water': return '💧';
    case 'garbage': return '🗑️';
    case 'electric': return '⚡';
    case 'lights': return '💡';
    default: return '📍';
  }
};

export default function MapPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedIssueCenter, setSelectedIssueCenter] = useState<[number, number] | null>(null);

  useEffect(() => {
    const fetchIssues = async () => {
      setLoading(true);
      try {
        const filterType = activeFilter !== 'All' ? activeFilter : undefined;
        const data = await getPublicIssues(filterType ? { type: filterType } : undefined);
        setIssues(data || []);
      } catch (err) {
        console.warn('Failed to fetch issues for map, displaying empty:', err);
        setIssues([]);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, [activeFilter]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-white dark:bg-[#0a0f1e] transition-colors duration-300">
      {/* Sidebar - Fixed 320px */}
      <div className="w-[320px] flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#111827]/50 flex flex-col h-full z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a0f1e] transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🗺 Community Issues
            </h1>
            <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
              {issues.length} Active
            </span>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setActiveFilter(filter);
                  setSelectedIssueCenter(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  activeFilter === filter 
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-md ring-2 ring-gray-900 dark:ring-gray-100 ring-offset-1 dark:ring-offset-[#0a0f1e]' 
                    : 'bg-gray-100 dark:bg-[#1e293b] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Issue List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {loading ? (
             <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse flex gap-3">
                     <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg shrink-0"></div>
                     <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
                     </div>
                  </div>
                ))}
             </div>
          ) : issues.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-2xl mb-4 shadow-inner">
                  🔍
                </div>
                <h3 className="text-gray-900 dark:text-white font-semibold mb-1">No issues found</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  We couldn't find any community issues matching your current filter.
                </p>
             </div>
          ) : (
            issues.map((issue) => (
              <div 
                key={issue.id}
                onClick={() => {
                  if (issue.latitude && issue.longitude) {
                     setSelectedIssueCenter([parseFloat(issue.latitude), parseFloat(issue.longitude)]);
                  }
                }}
                className={`bg-white dark:bg-[#111827] p-4 rounded-xl border transition-all cursor-pointer group ${
                  selectedIssueCenter && 
                  selectedIssueCenter[0] === parseFloat(issue.latitude) && 
                  selectedIssueCenter[1] === parseFloat(issue.longitude)
                    ? 'border-blue-500 shadow-[0_4px_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500 relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-1 before:bg-blue-500 before:rounded-r-full overflow-hidden'
                    : 'border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 ${
                     issue.priority === 'critical' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                     issue.priority === 'high' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' :
                     issue.priority === 'medium' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400' :
                     'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  }`}>
                    {getCategoryIcon(issue.type || issue.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1 gap-2">
                       <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate" title={`${issue.type || issue.category} - ${issue.location_text || issue.description}`}>
                         {issue.type || issue.category} • <span className="font-medium text-gray-700 dark:text-gray-400">{issue.location_text || 'Nearby Location'}</span>
                       </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium mb-3">
                       <span className={`px-2 py-0.5 rounded-full border ${
                         (issue.status === 'resolved' || issue.status === 'closed')
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                          : 'bg-gray-50 dark:bg-[#1e293b] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                       }`}>
                         {issue.status || 'open'}
                       </span>
                       <span className="text-gray-400 dark:text-gray-600">•</span>
                       <span className="text-gray-500 dark:text-gray-400">{issue.created_at ? timeAgo(issue.created_at) : 'recently'}</span>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                       <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1e293b] border border-gray-100 dark:border-gray-800 px-2 py-1 rounded-md">
                         <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                         </svg>
                         {issue.upvotes || 0}
                       </div>
                       <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                         </svg>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-gray-100 dark:bg-[#0a0f1e] w-full h-full">
        <MapView issues={issues} selectedIssueCenter={selectedIssueCenter} />
      </div>
    </div>
  );
}
