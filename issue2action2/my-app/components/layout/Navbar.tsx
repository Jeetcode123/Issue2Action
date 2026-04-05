"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

export const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Report', path: '/report' },
    { name: 'Track', path: '/track' },
    { name: 'Map', path: '/map' },
    { name: 'Help', path: '/help' },
    { name: 'Profile', path: '/profile' },
  ];

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-[#0a0f1e]/80 backdrop-blur-lg border-b border-gray-200 dark:border-[rgba(255,255,255,0.08)] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Logo className="text-gray-900 dark:text-white" href="/" />
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex flex-1 justify-center">
            <div className="flex items-center space-x-6 font-sans text-sm">
              {navLinks.map((link) => {
                const isActive = pathname === link.path;
                return (
                  <Link
                    key={link.name}
                    href={link.path}
                    className={`transition-colors duration-200 ${
                      isActive 
                        ? 'text-[#00e5a0] dark:text-[#00e5a0] font-semibold' 
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Call to Action + Theme Toggle */}
          <div className="hidden md:flex items-center space-x-4">
            <ThemeToggle />
            <Link href="/report">
              <button className="bg-[#00e5a0] hover:bg-[#00e5a0]/90 text-[#0a0f1e] px-4 py-2 rounded-[8px] font-sans font-semibold text-sm transition-all shadow-[0_0_15px_rgba(0,229,160,0.3)]">
                + Report Issue
              </button>
            </Link>
          </div>

          {/* Mobile Menu Button + Theme Toggle */}
          <div className="flex justify-center items-center md:hidden space-x-2">
            <ThemeToggle />
            <button
              onClick={toggleMenu}
              className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white p-2 rounded-md transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-[#0a0f1e] border-t border-gray-200 dark:border-[rgba(255,255,255,0.08)]">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 flex flex-col items-center">
            {navLinks.map((link) => {
              const isActive = pathname === link.path;
              return (
                <Link
                  key={link.name}
                  href={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-sans text-center w-full ${
                    isActive 
                      ? 'text-[#00e5a0] bg-gray-100 dark:bg-[rgba(255,255,255,0.04)] font-bold' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-[rgba(255,255,255,0.04)]'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
            <Link href="/report" onClick={() => setIsMobileMenuOpen(false)} className="w-full mt-4">
              <button className="w-full bg-[#00e5a0] text-[#0a0f1e] px-4 py-3 rounded-xl font-sans font-bold text-sm shadow-md">
                + Report Issue
              </button>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};
