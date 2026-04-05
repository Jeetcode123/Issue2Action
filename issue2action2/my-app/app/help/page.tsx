'use client';

import { useState } from 'react';
import { sendSupportMessage } from '@/lib/api';
import { getAuth } from '@/lib/auth';

const faqs = [
  {
    question: "How does Issue2Action work?",
    answer: "It follows a swift 4-step flow: 1. You report an issue. 2. Our AI instantly classifies and prioritizes it. 3. The issue is automatically routed to the correct local authority. 4. Authorities investigate and resolve it while you track progress."
  },
  {
    question: "Can I report without an account?",
    answer: "Yes, you can report as a guest for maximum convenience and anonymity. However, creating an account enables tracking your history, upvoting other issues, and receiving real-time notifications."
  },
  {
    question: "How accurate is AI classification?",
    answer: "Our engine achieves 94%+ accuracy across 12 distinct civic categories. It uses advanced Natural Language Processing (NLP) paired with image analysis to understand and categorize your context instantly."
  },
  {
    question: "What happens after I submit?",
    answer: "Your report is classified in under a second. It is then sent directly to the right municipal department's dashboard. You'll be notified via the app (and email if registered) at each step—from 'Received' to 'Resolved'."
  },
  {
    question: "How long does resolution take?",
    answer: "Response times vary based on severity: 'Critical' issues aim for 6–12h turnaround. 'Standard' issues generally take 24–72h. Because the platform bridges directly with operators, you can track this SLA in real time."
  },
  {
    question: "Can I report for my community?",
    answer: "Yes! In fact, AI automatically merges duplicate reports from the same area and boosts the priority of the overarching issue automatically. Power belongs to the community."
  },
  {
    question: "Is my data safe?",
    answer: "All personal identifiers are encrypted. Exact locations are used strictly for routing municipal authorities to the problem. We never sell or expose your personal data to third parties."
  }
];

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // Default open the first one
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const { userId } = getAuth();
      await sendSupportMessage(
        'User',
        userId ? `user-${userId.substring(0, 8)}@issue2action.app` : 'anonymous@issue2action.app',
        supportMessage
      );
      setSubmitStatus('success');
      setTimeout(() => {
        setIsModalOpen(false);
        setSupportMessage('');
        setSubmitStatus('idle');
      }, 2000);
    } catch (err) {
      console.error(err);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0a0f1e] text-gray-900 dark:text-gray-100 transition-colors duration-300 pt-16 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-3">
            Help & FAQ
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Everything you need to know about the Issue2Action platform and how to get help when you need it.
          </p>
        </div>

        {/* Accordion List */}
        <div className="bg-white dark:bg-[#1e293b]/70 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden mb-12 backdrop-blur-md">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index} 
                className={`border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${isOpen ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
              >
                <button
                  className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                  onClick={() => toggleAccordion(index)}
                >
                  <span className={`font-semibold text-base md:text-lg transition-colors ${isOpen ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-200'}`}>
                    {faq.question}
                  </span>
                  <div className={`ml-4 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isOpen ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}`}>
                    <svg
                      className={`w-5 h-5 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : 'rotate-0'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {/* CSS Grid Accordion Transition */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-5 text-gray-600 dark:text-gray-400 leading-relaxed">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact Support Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-8 relative overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-white opacity-5 rounded-full filter blur-2xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-5">
             <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
               <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
               </svg>
             </div>
             <div>
                <h3 className="text-xl font-bold text-white mb-1">Still need help?</h3>
                <p className="text-blue-100/90 max-w-md">
                  Our dedicated support team is ready to answer any specific questions you might have.
                </p>
             </div>
          </div>
          
          <div className="relative z-10 w-full md:w-auto shrink-0">
             <button
               onClick={() => setIsModalOpen(true)}
               className="w-full md:w-auto px-6 py-3 bg-white text-blue-700 font-bold rounded-lg shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600"
             >
               Start Live Chat
             </button>
          </div>
        </div>

      </div>

      {/* Contact Mode / Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
             className="absolute inset-0 bg-gray-900/40 dark:bg-[#0a0f1e]/80 backdrop-blur-sm" 
             onClick={() => setIsModalOpen(false)}
          ></div>
          
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 transform transition-all border border-transparent dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
               <h3 className="text-xl font-bold text-gray-900 dark:text-white">Message Support</h3>
               <button 
                 onClick={() => setIsModalOpen(false)}
                 className="text-gray-400 hover:text-gray-600 transition"
               >
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
            </div>
            
            <form onSubmit={handleSupportSubmit} className="p-6">
              {submitStatus === 'success' ? (
                 <div className="flex flex-col items-center justify-center py-8 text-center animate-pulse">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4">
                       <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                       </svg>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">Message Sent!</h4>
                    <p className="text-gray-600 dark:text-gray-400">Our support team will respond shortly.</p>
                 </div>
              ) : (
                <>
                  <div className="mb-5">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                       How can we help you?
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Describe your issue or question..."
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white bg-white dark:bg-[#0f172a] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    ></textarea>
                    {submitStatus === 'error' && (
                       <p className="text-red-500 text-sm mt-2 font-medium">Failed to send message. Please try again.</p>
                    )}
                  </div>
                  <div className="flex gap-3 justify-end mt-6">
                     <button
                       type="button"
                       onClick={() => setIsModalOpen(false)}
                       className="px-5 py-2.5 font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
                     >
                        Cancel
                     </button>
                     <button
                       type="submit"
                       disabled={isSubmitting || !supportMessage.trim()}
                       className="px-5 py-2.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center min-w-[120px]"
                     >
                       {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                       ) : (
                          'Send Message'
                       )}
                     </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
