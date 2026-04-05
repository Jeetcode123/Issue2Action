"use client";

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CheckCircle2, Circle, Clock, MessageSquare, Search, Send, User, Loader2, MapPin, Activity, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { insforge } from '@/lib/insforge';
import { PublicIssue, getPublicIssues, getIssue, replyToIssue } from '@/lib/api';
import { getAuth } from '@/lib/auth';

const MapView = dynamic(() => import('@/components/MapView'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  )
});

function TrackContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [activeIssue, setActiveIssue] = useState<any>(null);
  const [allIssues, setAllIssues] = useState<PublicIssue[]>([]);
  const [isLiveMode, setIsLiveMode] = useState(true); // Default to ON for live tracking
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState([
    { sender: 'System', text: 'Issue submitted successfully! Our team is reviewing it.', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), isUser: false }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // 1. Initial Fetch
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const publicData = await getPublicIssues();
      setAllIssues(publicData || []);

      if (id) {
        try {
          const specificIssue = await getIssue(id);
          setActiveIssue(specificIssue);
          if (specificIssue.timeline && specificIssue.timeline.length > 0) {
             const mappedTimeline = specificIssue.timeline.map((t: any) => ({
                 sender: t.event_type === 'user_reply' ? 'You' : (t.created_by === 'system' ? 'System' : 'Municipal Team'),
                 text: t.message || `Status updated to ${t.status || 'unknown'}`,
                 time: new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                 isUser: t.event_type === 'user_reply'
             }));
             setMessages(mappedTimeline.reverse());
          }
        } catch (err) {
          // Fallback if specific fetch fails but it's in public data
          const found = publicData.find(i => i.id === id || i.ticket_id === id);
          if (found) setActiveIssue(found);
        }
      }
    } catch (err) {
      console.error("Failed to fetch tracking data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [id]);

  // 2. Realtime Subscription (InsForge)
  useEffect(() => {
    if (!isLiveMode) return;

    let isSubscribed = true;
    
    insforge.realtime.connect().then(() => {
      insforge.realtime.subscribe('issues:feed').then(({ ok }) => {
        if (ok && isSubscribed) {
          insforge.realtime.on('issue_update', (payload) => {
             console.log("[Live Tracking] Realtime update:", payload);
             // Re-fetch implicitly maintains state, or we can patch
             fetchAllData(); 
          });
        }
      });
    });

    return () => {
      isSubscribed = false;
      insforge.realtime.unsubscribe('issues:feed');
    };
  }, [isLiveMode, id]);

  const handleSendMessage = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!chatInput.trim() || !activeIssue || isSending) return;
     
     const { userId } = getAuth();
     if (!userId) {
       setSendError('Please log in to send a message.');
       return;
     }

     setIsSending(true);
     setSendError('');
     
     const originalInput = chatInput;
     const newMsg = {
        sender: 'You',
        text: originalInput,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        isUser: true
     };
     
     // Optimistically update UI
     setMessages([...messages, newMsg]);
     setChatInput('');
     
     try {
       await replyToIssue(activeIssue.id || activeIssue.ticket_id, originalInput, userId);
       // Mutate data implicitly through realtime picking it up, or if realtime is off, it stays optimistic.
     } catch (err) {
       // Rollback message
       setMessages(messages.filter(m => m !== newMsg));
       setChatInput(originalInput);
       setSendError('Failed to send message.');
     } finally {
       setIsSending(false);
     }
  };

  const selectedCenter = useMemo<[number, number] | null>(() => {
    if (activeIssue && activeIssue.latitude && activeIssue.longitude) {
      return [parseFloat(activeIssue.latitude), parseFloat(activeIssue.longitude)];
    }
    return null;
  }, [activeIssue]);

  const getStatusStep = (status?: string | null, msgs?: any[]) => {
    const s = (status || '').toLowerCase();
    if (s === 'resolved' || s === 'closed') return 4;
    
    if (msgs && msgs.length > 0) {
       if (msgs.some(m => typeof m.text === 'string' && m.text.toLowerCase().includes('escalat'))) return 3;
       if (msgs.some(m => typeof m.text === 'string' && (m.text.toLowerCase().includes('reminder') || m.text.toLowerCase().includes('follow-up')))) return 2;
    }

    if (s === 'assigned') return 3;
    if (s === 'in progress' || s === 'in_progress') return 2;
    return 1; // Email Sent / Default
  };

  const currentStep = getStatusStep(activeIssue?.status, messages);

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
      
      {/* LEFT COLUMN: Tracking Details & Messages */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-[#0d1627] dark:text-white font-display flex items-center gap-2">
            {activeIssue ? `Tracking Ticket #${(activeIssue.ticket_id || activeIssue.id || '').substring(0, 8)}` : "Tracking Issue"}
            {isLoading && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
            </h1>
        </div>

        {/* Current Status Tracker */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl p-6 transition-colors duration-300 relative overflow-hidden"
        >
          {isLoading && !activeIssue && (
             <div className="absolute inset-0 bg-white/50 dark:bg-[#1e293b]/50 backdrop-blur-sm z-50 flex items-center justify-center">
                 <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
             </div>
          )}
          
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6 font-display">Current Status</h2>
          
          <div className="relative">
            {/* Background Line */}
            <div className="absolute top-4 left-0 w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
            
            {/* Progress Line */}
            <motion.div 
               className="absolute top-4 left-0 h-1.5 bg-gradient-to-r from-blue-500 to-green-400 rounded-full" 
               initial={{ width: '0%' }}
               animate={{ width: `${(currentStep - 1) * 33.33}%` }}
               transition={{ duration: 0.8, ease: "easeInOut" }}
            />

            <div className="relative flex justify-between">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-4 border-white dark:border-[#1e293b] shadow-sm z-10 transition-colors duration-300 ${currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {currentStep > 1 ? <Check className="w-4 h-4" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <span className={`text-xs font-semibold mt-2 ${currentStep >= 1 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>Email Sent</span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-4 border-white dark:border-[#1e293b] shadow-sm z-10 transition-colors duration-300 ${currentStep >= 2 ? 'bg-blue-400 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                  {currentStep > 2 ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-semibold mt-2 ${currentStep >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>Reminder Sent</span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-4 border-white dark:border-[#1e293b] shadow-sm z-10 transition-colors duration-300 ${currentStep >= 3 ? 'bg-yellow-400 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                  {currentStep > 3 ? <Check className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <span className={`text-xs font-semibold mt-2 ${currentStep >= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'}`}>Escalated</span>
              </div>
              
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-4 border-white dark:border-[#1e293b] shadow-sm z-10 transition-colors duration-300 ${currentStep >= 4 ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                  <Circle className="w-5 h-5" />
                </div>
                <span className={`text-xs font-semibold mt-2 ${currentStep >= 4 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>Resolved</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Chat / Messages Section */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl flex flex-col h-[400px] transition-colors duration-300"
        >
          <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-gray-700">
             <MessageSquare className="w-5 h-5 text-gray-400 dark:text-gray-500" />
             <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 font-display">Communication</h2>
          </div>
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            <AnimatePresence>
                {messages.map((msg, i) => {
                  const isSystemAlert = msg.sender === 'System' && msg.text.includes('Alert sent');
                  
                  return (
                    <motion.div 
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       key={i} 
                       className={`flex gap-3 ${msg.isUser ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                        <div className={`w-10 h-10 rounded-full border border-white dark:border-gray-600 shadow-sm overflow-hidden shrink-0 flex items-center justify-center ${isSystemAlert ? 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40' : 'bg-gradient-to-br from-indigo-100 dark:from-indigo-900/30 to-purple-100 dark:to-purple-900/30'}`}>
                        {isSystemAlert ? <Send className="w-5 h-5 text-emerald-600 dark:text-emerald-400 ml-[-2px]" /> : <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
                        </div>
                        <div className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{isSystemAlert ? 'Dispatch System' : msg.sender}</span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{msg.time}</span>
                        </div>
                        <div className={`px-4 py-3 text-sm shadow-sm ${msg.isUser ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' : isSystemAlert ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 rounded-2xl rounded-tl-none border border-emerald-200 dark:border-emerald-800/50' : 'bg-white dark:bg-[#0a0f1e] text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700'}`}>
                            {msg.text}
                            {isSystemAlert && (
                               <div className="mt-2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 bg-white/60 dark:bg-black/20 p-1.5 rounded-md border border-emerald-100/50 dark:border-emerald-800/30 w-fit">
                                  <CheckCircle2 className="w-3 h-3" /> Email Successfully Tracked to Transport Level
                               </div>
                            )}
                        </div>
                        </div>
                    </motion.div>
                  )
                })}
            </AnimatePresence>
          </div>
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-[#1e293b]/50 rounded-b-2xl">
            {sendError && <div className="text-red-500 text-xs font-semibold mb-2">{sendError}</div>}
            <div className="relative">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isSending}
                placeholder="Type a message to authorities..." 
                className="w-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-full px-5 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50" 
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isSending}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:hover:bg-blue-600"
              >
                 {isSending ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Send className="w-4 h-4 ml-[-2px] shrink-0" />}
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* RIGHT COLUMN: Real-Time Tracking & Map */}
      <div className="space-y-6">
        <div className="flex items-center justify-between lg:h-[32px] hidden lg:flex">
             <h1 className="text-2xl font-bold text-[#0d1627] dark:text-white font-display select-none">Live Map Tracking</h1>
             
             {/* Live Tracking Toggle UI */}
             <div className="flex items-center gap-3">
                 <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    {isLiveMode ? 'Live Updates ON' : 'Static Mode'}
                 </span>
                 <button 
                   onClick={() => setIsLiveMode(!isLiveMode)}
                   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isLiveMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                 >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isLiveMode ? 'translate-x-6' : 'translate-x-1'}`} />
                 </button>
             </div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl p-2 relative flex flex-col group h-[400px] overflow-hidden transition-colors duration-300"
        >
          {isLiveMode && (
             <div className="absolute top-4 right-4 z-[400] bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur text-gray-800 dark:text-gray-200 px-3 py-1.5 rounded-lg shadow-md text-xs font-bold flex items-center gap-2 border border-gray-100 dark:border-gray-700/50">
                <span className="relative flex h-2.5 w-2.5">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                Tracking Live
             </div>
          )}
          <div className="w-full h-full rounded-xl overflow-hidden relative z-0 relative">
             <MapView 
                issues={allIssues.length > 0 ? allIssues : (activeIssue ? [activeIssue] : [])} 
                selectedIssueCenter={selectedCenter} 
             />
             {isLoading && (
                 <div className="absolute inset-0 z-[500] bg-black/5 flex items-center justify-center pointer-events-none">
                     <div className="bg-white/80 dark:bg-black/80 px-4 py-2 rounded-full shadow-lg backdrop-blur-md flex items-center gap-3">
                         <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                         <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Syncing issues...</span>
                     </div>
                 </div>
             )}
          </div>
        </motion.div>

        {/* Selected Issue Details Card */}
        <AnimatePresence>
            {activeIssue && (
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.3 }}
                className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl p-6 relative overflow-hidden transition-colors duration-300"
            >
                <div className={`absolute top-0 left-0 w-1 h-full ${activeIssue.priority === 'critical' ? 'bg-red-500' : activeIssue.priority === 'high' ? 'bg-orange-400' : 'bg-blue-400'}`} />
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Issue Insight
                </h3>
                <p className="text-gray-800 dark:text-gray-200 text-sm mb-4 line-clamp-2">
                    {activeIssue.description}
                </p>
                
                <div className="bg-gray-50 dark:bg-[#0f172a] border border-gray-100 dark:border-gray-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mt-4 shadow-inner">
                    <div className="flex gap-4 items-center">
                        <div className="w-14 h-14 bg-white dark:bg-[#1e293b] rounded-xl shrink-0 overflow-hidden text-2xl flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm relative">
                        {activeIssue.status?.toLowerCase() === 'resolved' ? '✅' : '🚧'}
                        {isLiveMode && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>}
                        </div>
                        <div className="flex flex-col justify-center gap-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className={`w-2 h-2 rounded-full block ${activeIssue.priority === 'critical' ? 'bg-red-500' : activeIssue.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500'}`}></span>
                            Severity: <span className="font-bold text-gray-900 dark:text-gray-200 capitalize">{activeIssue.priority || 'Medium'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 block"></span>
                            Type: <span className="font-bold text-gray-900 dark:text-gray-200 capitalize">{activeIssue.type || 'General'}</span>
                        </div>
                        </div>
                    </div>
                    <div className="text-right flex flex-col gap-1 items-end w-full md:w-auto">
                         <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Estimated Fix</span>
                         <span className="text-sm font-semibold bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded inline-block">
                             {activeIssue.estimated_resolution || 'Pending Evaluation'}
                         </span>
                    </div>
                </div>
            </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
          <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Initializing Tracker...</p>
          </div>
      }>
         <TrackContent />
      </Suspense>
    </DashboardLayout>
  );
}
