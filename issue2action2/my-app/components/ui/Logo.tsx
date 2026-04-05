import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  isLink?: boolean;
  href?: string;
}

export function Logo({ className = "", isLink = true, href = "/" }: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-2.5 font-display", className)}>
      {/* Abstract Modern Icon */}
      <div className="relative flex items-center justify-center w-9 h-9 rounded-[10px] bg-gradient-to-br from-purple-500 via-indigo-600 to-indigo-800 shadow-[0_2px_12px_rgba(99,102,241,0.4)] overflow-hidden shrink-0 group-hover:shadow-[0_4px_20px_rgba(168,85,247,0.5)] transition-all duration-300">
         {/* Subtle inner curve overlay for 3D effect */}
         <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50" />
         
         <svg className="w-[18px] h-[18px] text-white relative z-10 drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Stylized Action/Thunder Symbol */}
            <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14H4z" fill="currentColor" fillOpacity="0.2"/>
         </svg>
      </div>
      
      {/* Brand Name */}
      <div className="text-[22px] font-extrabold tracking-tight flex items-center">
        Issue
        <span className="flex items-center justify-center mx-[2px]">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500 font-black italic -skew-x-[12deg] scale-110 drop-shadow-sm">
            2
          </span>
        </span>
        Action
      </div>
    </div>
  );

  if (isLink) {
    return (
      <Link href={href} className="group flex transition-transform hover:-translate-y-[1px] active:translate-y-0 relative z-50">
        {content}
      </Link>
    );
  }

  return content;
}
