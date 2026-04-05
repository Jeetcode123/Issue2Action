"use client";

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CheckCircle, TrendingUp, AlertCircle, Clock, Filter, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, useSpring, useTransform } from 'framer-motion';
import { PublicIssue, fetcher } from '@/lib/api';
import useSWR from 'swr';
import { insforge } from '@/lib/insforge';
import { StatusBadge } from '@/components/StatusBadge';

function AnimatedCounter({ value }: { value: number }) {
  const spring = useSpring(0, { bounce: 0, duration: 1000 });
  const display = useTransform(spring, (current) => Math.round(current));
  
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  
  return <motion.span>{display}</motion.span>;
}

export default function ImpactDashboard() {
  const [filters, setFilters] = useState({ type: '', status: '', time: 'all' });
  
  const query = new URLSearchParams();
  if (filters.type) query.append('type', filters.type);
  if (filters.status) query.append('status', filters.status);
  if (filters.time) query.append('time', filters.time);
  
  // SWR for data fetching
  const { data: fetchedIssues, error, isLoading, mutate } = useSWR<PublicIssue[]>(
    `/api/issues/public${query.toString() ? `?${query.toString()}` : ''}`,
    fetcher
  );

  const issues = fetchedIssues || [];

  // Real-time InsForge updates
  useEffect(() => {
    let isSubscribed = true;
    
    const setupRealtime = async () => {
      try {
        await insforge.realtime.connect();
        const { ok } = await insforge.realtime.subscribe('issues:feed');
         if (ok && isSubscribed) {
          insforge.realtime.on('issue_update', () => {
             // Mutate without clear
             mutate(undefined, { revalidate: true });
          });
        }
      } catch (err) {
        console.warn("Realtime SDK Error (Ignored)", err);
      }
    };
    
    setupRealtime();
    
    return () => {
      isSubscribed = false;
      insforge.realtime.unsubscribe('issues:feed');
    };
  }, [mutate]);

  // Compute live aggregates
  const totalIssues = issues.length;
  const pendingCount = issues.filter(i => ['reported', 'verified', 'assigned'].includes(i.status.toLowerCase())).length;
  const inProgressCount = issues.filter(i => i.status.toLowerCase() === 'in_progress').length;
  const resolvedCount = issues.filter(i => ['resolved', 'closed'].includes(i.status.toLowerCase())).length;
  
  const resolutionRate = totalIssues > 0 ? Math.round((resolvedCount / totalIssues) * 100) : 0;

  const stats = [
    { label: 'Pending Action', value: pendingCount, icon: AlertCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { label: 'In Progress', value: inProgressCount, icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Total Resolved', value: resolvedCount, icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    { label: 'Resolution Rate', value: resolutionRate, suffix: '%', icon: TrendingUp, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' }
  ];

  // Group breakdown by type
  const typeCount: Record<string, number> = {};
  issues.forEach(i => {
    const t = i.type || 'Other';
    typeCount[t] = (typeCount[t] || 0) + 1;
  });
  
  const typeColors = ['bg-green-500', 'bg-blue-500', 'bg-yellow-500', 'bg-purple-500'];
  const topTypes = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const issueBreakdown = topTypes.map(([label, count], idx) => ({
    label,
    percent: totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0,
    color: typeColors[idx % typeColors.length]
  }));

  // Fetch recent items for the live feed
  const recentFeed = [...issues]
    .sort((a, b) => {
      const bTime = new Date(b.created_at || 0).getTime();
      const aTime = new Date(a.created_at || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 4);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold text-[#0d1627] dark:text-white font-display">Impact Stats</h1>
          
          {/* Advanced Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white/50 dark:bg-[#1e293b]/50 p-2 rounded-xl backdrop-blur-sm border border-gray-100 dark:border-gray-700">
            <Filter className="w-4 h-4 text-gray-400 ml-2" />
            <select 
              value={filters.time}
              onChange={(e) => setFilters(f => ({ ...f, time: e.target.value }))}
              className="text-sm bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 cursor-pointer outline-none"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
            </select>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
            <select 
              value={filters.status}
              onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
              className="text-sm bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 cursor-pointer outline-none"
            >
              <option value="">All Statuses</option>
              <option value="reported">Reported</option>
              <option value="verified">Verified</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
            <select 
              value={filters.type}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
              className="text-sm bg-transparent border-none focus:ring-0 text-gray-700 dark:text-gray-200 cursor-pointer outline-none"
            >
              <option value="">All Categories</option>
              <option value="Road Damage">Road Damage</option>
              <option value="Water Leak">Water Leak</option>
              <option value="Garbage Dumping">Garbage Dumping</option>
              <option value="Broken Streetlights">Streetlights</option>
              <option value="Sewer Issue">Sewer Issue</option>
            </select>
          </div>
        </div>
        
        {/* Top Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              key={i} 
              className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl p-4 flex flex-col justify-between transition-colors duration-300 relative overflow-hidden group h-32"
            >
              <div className="flex justify-between items-start mb-2">
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", s.bg)}>
                  <s.icon className={cn("w-5 h-5", s.color)} />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-baseline">
                  {isLoading ? (
                    <div className="w-12 h-6 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
                  ) : (
                    <>
                      <AnimatedCounter value={s.value} />
                      {s.suffix && <span className="text-lg ml-0.5">{s.suffix}</span>}
                    </>
                  )}
                </h3>
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-0.5">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issues Transformed */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl p-6 transition-colors duration-300"
          >
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 font-display">Issues Transformed</h2>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full h-3"></div>
                ))}
              </div>
            ) : issueBreakdown.length > 0 ? (
              <div className="space-y-5">
                {issueBreakdown.map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm font-medium mb-1.5">
                      <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                      <span className="text-gray-900 dark:text-gray-100">
                         <AnimatedCounter value={item.percent} />%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700/50 rounded-full h-2.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percent}%` }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                        className={cn("h-full rounded-full transition-all", item.color)}
                      ></motion.div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
               <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                 <Inbox className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                 <p className="text-sm font-medium">No category breakdown found for these filters.</p>
               </div>
            )}
          </motion.div>

          {/* Issue Breakdown (Central Dashboard Metric) */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px] transition-colors duration-300 relative"
          >
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 font-display self-start absolute top-6 left-6">Community Reach</h2>
            <div className="relative w-48 h-48 rounded-full bg-gradient-to-tr from-green-400 via-blue-400 to-indigo-500 p-2 shadow-inner flex items-center justify-center animate-[spin_10s_linear_infinite]">
               <div className="w-44 h-44 bg-white dark:bg-[#1e293b] rounded-full flex items-center justify-center flex-col z-10 animate-[spin_10s_linear_infinite_reverse]">
                  <div className="w-40 h-40 bg-white/90 dark:bg-[#111827]/90 backdrop-blur-sm rounded-full shadow-lg border border-transparent dark:border-gray-700 flex items-center justify-center flex-col z-10 transition-colors duration-300">
                    <span className="text-gray-500 dark:text-gray-400 font-medium text-sm">Total Reports</span>
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white mt-1">
                      {isLoading ? "-" : <AnimatedCounter value={totalIssues} />}
                    </span>
                  </div>
               </div>
               
               {/* Orbital dots for premium feel */}
               <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full shadow-md"></div>
               <div className="absolute bottom-4 left-4 w-2 h-2 bg-white/70 rounded-full"></div>
            </div>
          </motion.div>
        </div>

        {/* Live Feed */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl p-6 transition-colors duration-300"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 font-display flex items-center gap-2">
               {totalIssues > 0 && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>}
               Live City Feed
            </h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
            {error ? (
               <div className="flex flex-col items-center justify-center w-full py-10 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900 text-red-500">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-80" />
                  <p className="font-semibold text-sm">Unable to load issues</p>
                  <p className="text-xs mt-1 text-red-400 dark:text-red-500/80">Make sure your backend API is online.</p>
               </div>
            ) : isLoading ? (
               <div className="flex gap-4">
                 {[1, 2, 3].map(i => (
                   <div key={i} className="min-w-[300px] w-[300px] h-[100px] bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl border border-gray-100 dark:border-gray-700"></div>
                 ))}
               </div>
            ) : recentFeed.length > 0 ? (
               recentFeed.map((issue) => (
                <div key={issue.id} className="min-w-[300px] w-full md:w-[350px] bg-white dark:bg-[#111827] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-start gap-4 transition-colors duration-300 relative group overflow-hidden hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900 cursor-default">
                  <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center mt-1 bg-gray-100 dark:bg-gray-800">
                     <StatusBadge status={issue.status} className="border-none bg-transparent p-0" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                       <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 line-clamp-1">{issue.description || `${issue.type} Issue`}</h4>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 h-8">{issue.description}</p>
                    <div className="mt-3 flex gap-2 flex-wrap">
                       <span className="text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                         {issue.ward || 'Unknown'}
                       </span>
                       <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded">
                         {issue.type || 'General'}
                       </span>
                       {issue.authority_notified && (
                         <span className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
                           <CheckCircle className="w-3 h-3" /> Notified
                         </span>
                       )}
                    </div>
                  </div>
                </div>
               ))
            ) : (
               <div className="flex flex-col items-center justify-center w-full py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20">
                 <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                   <Inbox className="w-8 h-8 text-blue-400 dark:text-blue-500" />
                 </div>
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Reports Found</h3>
                 <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm text-center mt-1">
                   There are no reports matching your current filter criteria. Try adjusting the filters or report a new issue to get started.
                 </p>
               </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
