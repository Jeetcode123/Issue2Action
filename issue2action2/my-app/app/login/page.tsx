"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { loginUser, registerUser } from "@/lib/api";
import { saveAuth, isLoggedIn } from "@/lib/auth";
import { GuestGuard } from "@/components/auth/GuestGuard";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParams = searchParams.get("redirect");

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // Sign In Fields
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign Up Fields
  const [signUpFirstName, setSignUpFirstName] = useState("");
  const [signUpLastName, setSignUpLastName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpCityWard, setSignUpCityWard] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // Email Verification Fields
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailOtp, setEmailOtp] = useState<string[]>(Array(6).fill(""));
  const emailOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleEmailOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...emailOtp];
    newOtp[index] = value;
    setEmailOtp(newOtp);

    if (value !== "" && index < 5) {
      emailOtpRefs.current[index + 1]?.focus();
    }

    if (newOtp.join("").length === 6) {
       setTimeout(() => handleVerifyEmailOTP(undefined, newOtp.join("")), 50);
    }
  };

  const handleEmailOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (emailOtp[index] === "" && index > 0) {
        emailOtpRefs.current[index - 1]?.focus();
        const newOtp = [...emailOtp];
        newOtp[index - 1] = "";
        setEmailOtp(newOtp);
      } else {
        const newOtp = [...emailOtp];
        newOtp[index] = "";
        setEmailOtp(newOtp);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      emailOtpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      emailOtpRefs.current[index + 1]?.focus();
    }
  };

  const handleEmailOtpPaste = (e: React.ClipboardEvent) => {
     e.preventDefault();
     const pastedData = e.clipboardData.getData('text/plain').slice(0, 6).replace(/\D/g, '');
     if (!pastedData) return;
     const newOtp = [...emailOtp];
     for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
     }
     setEmailOtp(newOtp);
     if (pastedData.length < 6) {
        emailOtpRefs.current[pastedData.length]?.focus();
     } else {
        emailOtpRefs.current[5]?.focus();
        setTimeout(() => handleVerifyEmailOTP(undefined, newOtp.join("")), 50);
     }
  };

  const handleVerifyEmailOTP = async (e?: React.FormEvent, otpString?: string) => {
    if (e) e.preventDefault();
    const otpCode = otpString || emailOtp.join("");
    if (otpCode.length < 6) return;
    setIsLoading(true);
    setError(null);
    try {
      const { insforge } = await import('@/lib/insforge');
      const currentEmail = activeTab === "signup" ? signUpEmail : signInEmail;

      const { data, error } = await insforge.auth.verifyEmail({
        email: currentEmail,
        otp: otpCode
      });

      if (error) throw error;

      if (data?.accessToken && data?.user?.id) {
         saveAuth(data.accessToken, data.user.id);
         handleRedirect();
      } else {
         throw new Error("Verification successful, but session could not be established.");
      }
    } catch (err: any) {
      setError(err.message || "Invalid verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Session state now fully handled by GuestGuard at the page component level automatically
  }, []);

  const handleRedirect = () => {
    if (redirectParams) {
      router.push(redirectParams);
    } else {
      router.push("/dashboard");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Use native InsForge SDK directly on client to inject secure HTTP cookies/session explicitly
      const { insforge } = await import('@/lib/insforge');
      const { data, error } = await insforge.auth.signInWithPassword({
        email: signInEmail,
        password: signInPassword
      });
      
      if (error || !data?.user) throw error || new Error("Failed to authenticate.");
      
      if (data.accessToken && data.user.id) {
        saveAuth(data.accessToken, data.user.id);
      }
      handleRedirect();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { insforge } = await import('@/lib/insforge');
      const name = `${signUpFirstName} ${signUpLastName}`.trim();
      
      // 1. Native SDK Signup to anchor tracking sessions
      const { data, error } = await insforge.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        name
      });
      
      if (error) throw error;

      // 2. Fallback to API sync to ensure our DB `users` table tracks cityWard 
      try {
        await registerUser(signUpFirstName, signUpLastName, signUpEmail, signUpCityWard, signUpPassword);
      } catch (proxyErr) {
        // Soft fail
      }
      
      // Auto-inject tokens if instantly verified
      if (data?.accessToken && data?.user?.id) {
        saveAuth(data.accessToken, data.user.id);
        handleRedirect();
      } else {
        setShowEmailVerification(true);
        setError("Account created! We sent a 6-digit verification code to your email. Please enter it below.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Removed manual phone OTP API handlers

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 font-sans overflow-hidden py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      {/* Absolute Header with Home and ThemeToggle */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-50">
         <Link href="/" className="text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white flex items-center gap-2 text-sm font-semibold transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Home
         </Link>
         <ThemeToggle />
      </div>

      {/* Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='%23000000' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px'
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .dark .absolute.inset-0.pointer-events-none {
           background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E") !important;
        }
      `}} />
      
      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-gray-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl dark:shadow-2xl transition-colors duration-300">
        
        {/* Header styling */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="mb-6">
            <Logo className="text-gray-900 dark:text-zinc-100 scale-110 drop-shadow-md" href="/" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome back to your city
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">
            Continue to your dashboard to report & track issues.
          </p>
        </div>

        {/* Tab Switcher */}
        {!showEmailVerification && (
          <div className="flex bg-gray-100 dark:bg-zinc-950 p-1 rounded-xl mb-8 border border-gray-200 dark:border-zinc-800 transition-colors duration-300">
            <button
              type="button"
              onClick={() => {
                setActiveTab("signin");
                setError(null);
              }}
              className={`flex-1 text-sm font-medium py-2.5 rounded-lg transition-all ${
                activeTab === "signin"
                  ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("signup");
                setError(null);
              }}
              className={`flex-1 text-sm font-medium py-2.5 rounded-lg transition-all ${
                activeTab === "signup"
                  ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* -------------------- SIGN IN FORM -------------------- */}
        {!showEmailVerification && activeTab === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                Email address
              </label>
              <input
                type="email"
                required
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-sans"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Password
                </label>
                <Link href="#" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showSignInPassword ? "text" : "password"}
                  required
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 pr-12 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-sans"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSignInPassword(!showSignInPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showSignInPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
            >
              {isLoading ? "Signing in..." : "Sign In"}
              {!isLoading && (
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              )}
            </button>
          </form>
        )}

        {/* -------------------- SIGN UP FORM -------------------- */}
        {!showEmailVerification && activeTab === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={signUpFirstName}
                  onChange={(e) => setSignUpFirstName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-sans"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={signUpLastName}
                  onChange={(e) => setSignUpLastName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-sans"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Email address</label>
              <input
                type="email"
                required
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-sans"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">City / Ward</label>
              <input
                type="text"
                required
                value={signUpCityWard}
                onChange={(e) => setSignUpCityWard(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-sans"
                placeholder="e.g. Downtown / Ward 3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showSignUpPassword ? "text" : "password"}
                  required
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3 pr-12 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-sans"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showSignUpPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
            >
              {isLoading ? "Creating Account..." : "Create Account"}
              {!isLoading && (
                <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              )}
            </button>
          </form>
        )}

        {/* -------------------- EMAIL VERIFICATION FORM -------------------- */}
        {showEmailVerification && (
          <form onSubmit={handleVerifyEmailOTP} className="space-y-4">
             <div className="text-sm text-gray-600 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-gray-200 dark:border-zinc-800/50 text-center">
               Code sent to <span className="text-gray-900 dark:text-white font-medium">{activeTab === "signup" ? signUpEmail : signInEmail}</span>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2 text-center text-lg">Enter Verification Code</label>
                <div className="flex gap-2 justify-between">
                  {emailOtp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { emailOtpRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleEmailOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleEmailOtpKeyDown(index, e)}
                      onPaste={handleEmailOtpPaste}
                      className={`w-12 h-14 bg-white dark:bg-zinc-900 border ${digit ? 'border-blue-500' : 'border-gray-200 dark:border-zinc-800'} rounded-xl text-center text-xl font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono`}
                    />
                  ))}
                </div>
             </div>
             {error && (
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
                </div>
              )}
             <button
                type="submit"
                disabled={isLoading || emailOtp.join("").length < 6}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center shadow-sm"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify Code
                    <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </>
                )}
              </button>
              
              <button 
               type="button"
               onClick={() => {
                 setShowEmailVerification(false);
                 setError(null);
               }}
               className="w-full mt-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white flex items-center justify-center gap-1 transition-colors py-2"
              >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
               Back to Sign Up
              </button>
          </form>
        )}

        {/* -------------------- SOCIAL OPTIONS -------------------- */}
        {!showEmailVerification && (
          <div className="mt-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-zinc-900 px-3 text-gray-500 dark:text-zinc-500 uppercase tracking-wider font-semibold transition-colors duration-300">Or continue with</span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Google OAuth (simulated redirect or use InsForge URL) */}
              <button
                onClick={async () => {
                   try {
                     const { insforge } = await import('@/lib/insforge');
                     await insforge.auth.signInWithOAuth({
                       provider: 'google',
                       redirectTo: window.location.origin + '/dashboard',
                     });
                   } catch (err) {
                     console.error(err);
                   }
                }}
                className="w-full flex items-center justify-center gap-3 bg-gray-50 dark:bg-zinc-950 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 text-gray-900 dark:text-white font-medium py-3 rounded-xl transition-all shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-1 7.28-2.69l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.87 0-5.3-1.94-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.69-.35-1.43-.35-2.09s.13-1.4.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                  <path d="M1 1h22v22H1z" fill="none" />
                </svg>
                Continue with Google
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <GuestGuard>
      <Suspense fallback={
         <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center transition-colors duration-300">
           <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
         </div>
      }>
        <LoginContent />
      </Suspense>
    </GuestGuard>
  );
}
