"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Image as ImageIcon, BrainCircuit, Activity, ShieldCheck, ShieldAlert, BadgeCheck, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

export default function PremiumLandingPage() {
  const [mounted, setMounted] = useState(false);
  const { scrollYProgress } = useScroll();
  const yBackground = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null; // Avoid hydration mismatch

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-[#0a0f1e] text-gray-900 dark:text-gray-100 font-sans overflow-hidden selection:bg-purple-200 transition-colors duration-300">
      
      {/* Background Animated Gradient Mesh / Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-gradient-to-b from-white dark:from-[#0a0f1e] to-purple-50/50 dark:to-purple-900/20">
        <motion.div style={{ y: yBackground }} className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] bg-purple-300/30 rounded-full blur-[120px]" />
        <motion.div style={{ y: yBackground }} className="absolute top-[20%] -right-[10%] w-[40vw] h-[40vw] bg-indigo-200/40 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-multiply"></div>
      </div>

      {/* Modern NavBar */}
      <nav className="fixed w-full z-50 transition-all duration-300 top-0 py-6 px-6 md:px-12 backdrop-blur-md bg-white/60 dark:bg-[#0a0f1e]/60 border-b border-purple-100 dark:border-purple-900/30">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Logo className="text-gray-900 dark:text-white drop-shadow-sm" href="/" />
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="hidden sm:block text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              Dashboard
            </Link>
            <Link href="/login" className="hidden sm:block text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              Sign In
            </Link>
            <Link href="/dashboard" className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-44 pb-32 px-6 md:px-12 max-w-7xl mx-auto flex flex-col items-center text-center">
        <motion.div 
           initial={{ opacity: 0, scale: 0.9, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           transition={{ duration: 0.5 }}
           className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/30 text-purple-700 dark:text-purple-300 text-sm font-semibold mb-10 shadow-sm"
        >
          <span className="flex h-2 w-2 rounded-full bg-purple-500 animate-pulse"></span>
          Now available for citizens everywhere
        </motion.div>

        <motion.h1 
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.7, delay: 0.1 }}
           className="text-5xl md:text-7xl lg:text-8xl font-extrabold font-display leading-[1.1] tracking-tight mb-8 text-gray-900 dark:text-white"
        >
          Turn Issues <br className="hidden md:block"/> into <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600">Action.</span>
        </motion.h1>

        <motion.p 
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.7, delay: 0.2 }}
           className="text-lg md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mb-14 leading-relaxed font-light"
        >
          An AI-powered platform to report, track, and resolve real-world civic problems efficiently and with complete transparency.
        </motion.p>

        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.7, delay: 0.3 }}
           className="flex flex-col sm:flex-row gap-5 w-full sm:w-auto"
        >
          <Link href="/dashboard" className="group flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-10 py-5 rounded-full font-bold text-lg md:text-xl transition-all shadow-[0_10px_25px_rgba(168,85,247,0.4)] hover:shadow-[0_15px_35px_rgba(168,85,247,0.5)]">
            Open Dashboard <ArrowRight className="w-6 h-6 group-hover:translate-x-1.5 transition-transform" />
          </Link>
        </motion.div>

        {/* Hero Image Mockup (Simulation) */}
        <motion.div 
           initial={{ opacity: 0, y: 60 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1, delay: 0.5, type: 'spring', stiffness: 50 }}
           className="mt-20 w-full max-w-5xl rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-xl shadow-2xl overflow-hidden relative"
        >
           {/* Mockup Topbar */}
           <div className="h-12 border-b border-gray-100 dark:border-gray-800 flex items-center px-6 gap-2 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
           </div>
           {/* Mockup Interface Element */}
           <div className="p-8 aspect-[16/9] flex flex-col justify-center items-center text-center gap-6 bg-gradient-to-t from-purple-50/30 dark:from-purple-900/10 to-transparent">
              <div className="w-24 h-24 rounded-full bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 flex items-center justify-center shadow-lg relative">
                 <ShieldAlert className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                 <span className="absolute -top-2 -right-2 flex h-5 w-5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-indigo-500 border-2 border-white dark:border-gray-900"></span>
                 </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold font-display tracking-wide text-gray-900 dark:text-white">Pothole on Main Street</h3>
                <p className="text-gray-500 mt-2 font-medium">AI Status: Automatically Assigned to City PW</p>
              </div>
              <div className="w-full max-w-2xl h-2 bg-gray-100 rounded-full overflow-hidden mt-4 shadow-inner">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: "65%" }}
                   transition={{ duration: 1.5, delay: 1 }}
                   className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                 />
              </div>
           </div>
        </motion.div>
      </section>

      {/* Trust Section */}
      <section className="py-20 border-y border-purple-100 dark:border-gray-800 bg-white/50 dark:bg-[#0a0f1e]/50 backdrop-blur-md">
         <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1 flex flex-col items-start justify-center">
               <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase mb-2">Trusted By</h3>
               <p className="text-2xl font-display font-medium text-gray-900 dark:text-white max-w-[200px]">Municipalities & Citizens</p>
            </div>
            <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-6 items-center">
               <div className="flex flex-col gap-1 border-l border-gray-200 dark:border-gray-800 pl-6">
                 <span className="text-4xl font-extrabold text-gray-900">4.5k<span className="text-purple-600">+</span></span>
                 <span className="text-sm text-gray-500 font-semibold uppercase tracking-wider mt-1">Issues Resolved</span>
               </div>
               <div className="flex flex-col gap-1 border-l border-gray-200 dark:border-gray-800 pl-6">
                 <span className="text-4xl font-extrabold text-gray-900 dark:text-white">87<span className="text-indigo-600 dark:text-indigo-400">%</span></span>
                 <span className="text-sm text-gray-500 font-semibold uppercase tracking-wider mt-1">Faster Responses</span>
               </div>
               <div className="flex items-center gap-3 border-l border-gray-200 dark:border-gray-800 pl-6 group">
                 <ShieldCheck className="w-10 h-10 text-gray-400 dark:text-gray-600 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                 <span className="font-bold text-gray-700 dark:text-gray-300">Secure<br/>System</span>
               </div>
               <div className="flex items-center gap-3 border-l border-gray-200 dark:border-gray-800 pl-6 group">
                 <BadgeCheck className="w-10 h-10 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                 <span className="font-bold text-gray-700">AI Powered<br/>Routing</span>
               </div>
            </div>
         </div>
      </section>

      {/* Features Section */}
      <section className="py-32 px-6 md:px-12 max-w-7xl mx-auto relative">
         <div className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-gray-900 dark:text-white">Designed for speed, built for impact</h2>
            <p className="text-gray-600 dark:text-gray-400 text-lg md:text-xl">Our architecture processes your civic complaints rapidly, cutting out bureaucratic delays completely.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div 
               initial={{ opacity: 0, y: 30 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.5 }}
               className="bg-white dark:bg-[#111827] hover:bg-purple-50/50 dark:hover:bg-purple-900/10 border border-gray-200 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800 p-10 rounded-[2rem] transition-all group shadow-sm hover:shadow-xl"
            >
               <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-8 border border-purple-200 dark:border-purple-800 group-hover:scale-110 group-hover:bg-purple-600 transition-all duration-300">
                  <ImageIcon className="w-8 h-8 text-purple-600 dark:text-purple-400 group-hover:text-white transition-colors" />
               </div>
               <h3 className="text-2xl font-bold mb-4 font-display text-gray-900 dark:text-white">Report Visually</h3>
               <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">Snap a photo and let our interface auto-detect your location via advanced mapping layers.</p>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 30 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.5, delay: 0.1 }}
               className="bg-white dark:bg-[#111827] hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 border border-gray-200 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 p-10 rounded-[2rem] transition-all group shadow-sm hover:shadow-xl"
            >
               <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-8 border border-indigo-200 dark:border-indigo-800 group-hover:scale-110 group-hover:bg-indigo-600 transition-all duration-300">
                  <BrainCircuit className="w-8 h-8 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
               </div>
               <h3 className="text-2xl font-bold mb-4 font-display text-gray-900 dark:text-white">AI Analysis</h3>
               <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">Our AI model instantly extracts the context to categorize and predict priority levels.</p>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 30 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.5, delay: 0.2 }}
               className="bg-white dark:bg-[#111827] hover:bg-fuchsia-50/50 dark:hover:bg-fuchsia-900/10 border border-gray-200 dark:border-gray-800 hover:border-fuchsia-200 dark:hover:border-fuchsia-800 p-10 rounded-[2rem] transition-all group shadow-sm hover:shadow-xl"
            >
               <div className="w-16 h-16 rounded-2xl bg-fuchsia-100 dark:bg-fuchsia-900/30 flex items-center justify-center mb-8 border border-fuchsia-200 dark:border-fuchsia-800 group-hover:scale-110 group-hover:bg-fuchsia-600 transition-all duration-300">
                  <Activity className="w-8 h-8 text-fuchsia-600 dark:text-fuchsia-400 group-hover:text-white transition-colors" />
               </div>
               <h3 className="text-2xl font-bold mb-4 font-display text-gray-900 dark:text-white">Live Tracking</h3>
               <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">Receive immediate feedback as officials resolve your issues alongside community interactions.</p>
            </motion.div>
         </div>
      </section>

      {/* How It Works (Steps) */}
      <section className="py-32 bg-white/60 dark:bg-transparent border-y border-purple-100 dark:border-purple-900/30 relative shadow-[inset_0_0_100px_rgba(233,213,255,0.2)] dark:shadow-[inset_0_0_100px_rgba(88,28,135,0.1)]">
         <div className="max-w-7xl mx-auto px-6 md:px-12">
           <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-gray-900 dark:text-white">How it operates</h2>
              <p className="text-gray-600 dark:text-gray-400 text-xl">From submission to resolution in three simple steps.</p>
           </div>
           
           <div className="flex flex-col md:flex-row justify-center gap-10 md:gap-0 relative">
             {/* Gradient Connector */}
             <div className="hidden md:block absolute top-[45px] left-[15%] right-[15%] h-1 bg-gradient-to-r from-purple-100 via-indigo-300 to-purple-100 rounded-full z-0" />
             
             {[
               { id: "01", title: "Upload Issue", desc: "Take a picture of the pothole or hazard and write a short title." },
               { id: "02", title: "AI Processing", desc: "The AI extracts keywords to identify the exact municipal department." },
               { id: "03", title: "Action Taken", desc: "A dashboard assigns the specific task. Crews fix the problem." }
             ].map((step, idx) => (
                <motion.div 
                   key={idx}
                   initial={{ opacity: 0, y: 30 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   viewport={{ once: true, margin: "-100px" }}
                   transition={{ duration: 0.5, delay: idx * 0.2 }}
                   className="flex-1 flex flex-col items-center text-center px-4 relative z-10"
                >
                   <div className="w-24 h-24 rounded-full bg-white dark:bg-[#111827] border-[6px] border-white dark:border-[#111827] shadow-[0_0_20px_rgba(168,85,247,0.2)] dark:shadow-[0_0_20px_rgba(168,85,247,0.1)] mb-8 flex items-center justify-center text-3xl font-display font-black text-purple-600 group-hover:scale-110 transition-transform relative">
                     <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 opacity-10"></div>
                     {step.id}
                   </div>
                   <h3 className="text-2xl font-bold mb-4 font-display text-gray-900 dark:text-white">{step.title}</h3>
                   <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">{step.desc}</p>
                </motion.div>
             ))}
           </div>
         </div>
      </section>

      {/* CTA Bottom Section */}
      <section className="py-32 px-6">
         <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="max-w-5xl mx-auto rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden bg-gray-900 border border-gray-800 shadow-[0_20px_50px_rgba(168,85,247,0.25)]"
         >
            {/* Inner Glows */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/30 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-indigo-500/30 rounded-full blur-[100px] pointer-events-none" />
            
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-6 text-white relative z-10 leading-tight">
               Ready to improve your city?
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-12 relative z-10">
               Join thousands of citizens making a tangible difference today. Start your first report instantly, absolutely free.
            </p>
            <Link href="/dashboard" className="relative z-10 inline-flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 px-10 py-5 rounded-full font-bold text-xl transition-all hover:scale-105 shadow-xl">
               Get Started Now <ArrowRight className="w-6 h-6" />
            </Link>
         </motion.div>
      </section>

      {/* Footer minimal */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12 text-center text-gray-500 bg-white dark:bg-[#0a0f1e] transition-colors duration-300">
         <div className="flex items-center justify-center mb-6">
           <Logo className="text-gray-700 dark:text-gray-300 scale-90 grayscale opacity-80" isLink={false} />
         </div>
         <p className="text-sm font-medium">© {new Date().getFullYear()} Issue2Action. Empowering civic transformations globally.</p>
      </footer>
    </div>
  );
}
