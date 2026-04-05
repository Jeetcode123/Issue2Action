"use client";

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { MapPin, Camera, Send, Loader2, Search, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { createIssue, CreateIssuePayload } from '@/lib/api';
import dynamic from 'next/dynamic';

// Dynamic import for leaflet to avoid SSR issues
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-200 dark:bg-gray-800 animate-pulse rounded-2xl flex items-center justify-center text-gray-500 dark:text-gray-400">Loading Map...</div>
});

const CATEGORIES = [
  "Road",
  "Water",
  "Garbage",
  "Electric",
  "Sewer"
];

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  isUploading: boolean;
  uploadProgressText: string;
  url?: string;
}

export default function ReportIssuePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState('');
  
  // Image handling
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Location search state
  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const fetchPlaces = async () => {
      if (searchQuery.length < 3) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`);
        const data = await res.json();
        setSuggestions(data);
      } catch (err) {
        // Silently catch fetch errors
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(() => {
       if (showSuggestions) {
          fetchPlaces();
       }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, showSuggestions]);

  const handleSelectSuggestion = (place: any) => {
    setSearchQuery(place.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    setLocation({
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon)
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (images.length + files.length > 5) {
      setFormError("You can only upload up to 5 images.");
      return;
    }

    setFormError('');

    // Prevent duplicate files based on name + size
    const newFiles = files.filter(file => !images.some(img => img.file.name === file.name && img.file.size === file.size));

    if (newFiles.length === 0) {
      setFormError("These images are already added.");
      return;
    }

    const newImages = newFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      isUploading: true,
      uploadProgressText: 'Uploading...'
    }));

    // Save current length to check if we are the first image for AI category detection
    const isFirstImage = images.length === 0;

    setImages(prev => [...prev, ...newImages]);

    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }

    try {
      const { insforge } = await import('@/lib/insforge');

      for (let i = 0; i < newImages.length; i++) {
         const newImg = newImages[i];
         try {
           setImages(prev => prev.map(img => img.id === newImg.id ? { ...img, uploadProgressText: 'Uploading to storage...' } : img));
           const { data, error } = await insforge.storage.from('issues').uploadAuto(newImg.file);
           
           if (error || !data) {
              setFormError(`Failed to upload ${newImg.file.name}`);
              setImages(prev => prev.filter(img => img.id !== newImg.id));
              continue;
           }
           
           const publicUrl = data.url;
           
           setImages(prev => prev.map(img => img.id === newImg.id ? { ...img, url: publicUrl, isUploading: false, uploadProgressText: '' } : img));
           
           if (isFirstImage && i === 0) {
              setImages(prev => prev.map(img => img.id === newImg.id ? { ...img, uploadProgressText: 'Analyzing with AI...', isUploading: true } : img));
              try {
                  const response = await insforge.ai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{
                      role: 'user',
                      content: [
                        { type: 'text', text: `Classify this issue strictly into exactly one of these categories: ${CATEGORIES.join(', ')}. Return ONLY the exact category string.` },
                        { type: 'image_url', image_url: { url: publicUrl } }
                      ]
                    }]
                  });
                  if (response.choices && response.choices.length > 0) {
                      const detectedCategory = response.choices[0].message.content.trim().replace(/['"]/g, '');
                      // basic match
                      const matched = CATEGORIES.find(c => detectedCategory.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(detectedCategory.toLowerCase()));
                      if (matched) setCategory(matched);
                      else setCategory(''); // Force manual selection if AI fails to match enum
                  }
              } catch (aiErr) {
                 // Ignore AI failure
              } finally {
                  setImages(prev => prev.map(img => img.id === newImg.id ? { ...img, isUploading: false, uploadProgressText: '' } : img));
              }
           }
           
         } catch (err) {
            setFormError(`Failed to upload ${newImg.file.name}`);
            setImages(prev => prev.filter(img => img.id !== newImg.id));
         }
      }
    } catch (err) {
        setFormError("Error uploading images.");
    }
  };

  const handleRemoveImage = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    const imageToRemove = images.find(img => img.id === id);
    if (!imageToRemove) return;

    if (imageToRemove.url) {
      try {
        const { insforge } = await import('@/lib/insforge');
        const urlParts = imageToRemove.url.split('/');
        const filename = decodeURIComponent(urlParts[urlParts.length - 1]);
        if (filename) {
          await insforge.storage.from('issues').remove([filename] as any);
        }
      } catch (err) {
        console.error("Failed to remove from storage", err);
      }
    }

    setImages(prev => prev.filter(img => img.id !== id));
  };

  const detectLocation = () => {
    setLocationError('');
    setIsDetectingLocation(true);
    setSearchQuery('');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setIsDetectingLocation(false);
        },
        (error) => {
          setIsDetectingLocation(false);
          if (error.code === error.PERMISSION_DENIED) {
             setLocationError("Location access required");
          } else {
             setLocationError("Failed to detect location");
          }
        },
        { enableHighAccuracy: true }
      );
    } else {
      setIsDetectingLocation(false);
      setLocationError("Geolocation not supported");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (images.length === 0 || !images.every(img => img.url && !img.isUploading)) {
       setFormError('Please upload at least one image and wait for all uploads to finish.');
       return;
    }
    if (!location) {
       setFormError('Please select the exact location on the map using "Detect Location" or by clicking on the map.');
       return;
    }
    if (!title.trim()) {
       setFormError('Please provide an issue title.');
       return;
    }
    if (!category) {
       setFormError('Please select a category for the issue.');
       return;
    }

    setIsSubmitting(true);
    
    try {
       const { insforge } = await import('@/lib/insforge');
       
       const { userId } = getAuth();
       
       if (!userId) {
          setFormError("Authentication expired. Please log in again.");
          return;
       }
       
       const issuePayload: CreateIssuePayload = {
          description: title,
          type: category,
          image_url: images.length > 0 ? images[0].url : undefined,
          image_urls: images.length > 0 ? (images.map(img => img.url).filter(Boolean) as string[]) : undefined,
          location_text: searchQuery || location.lat.toString(),
          latitude: location.lat,
          longitude: location.lng,
          ward: 'Default Ward', // could extract from coordinates in real world
          user_id: userId
       };
       
       const created = await createIssue(issuePayload);
       
       setSuccessMessage('Issue reported successfully! Redirecting...');
       
       // Redirect directly to the specific tracker page
       const ticketIdForUrl = created.ticket_id || created.id;
       router.push(`/track?id=${ticketIdForUrl}`);
       
    } catch (err: any) {
       setFormError(err.message || "An unexpected error occurred while saving.");
    } finally {
       setIsSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold text-[#0d1627] dark:text-white font-display">Report an Issue</h1>
          
          {/* Map Section */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl p-2 relative h-[300px] transition-colors duration-300 z-10"
          >
            {/* Search Input Box */}
            <div ref={searchContainerRef} className="absolute top-4 left-4 z-[9999] w-[260px] sm:w-[350px] pointer-events-auto">
              <div className="relative bg-white dark:bg-[#111827] rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] ring-1 ring-gray-200 dark:ring-gray-800 flex items-center p-1.5 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                <div className="text-gray-400 pl-2">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search location (e.g., Main Street, Kolkata)"
                  className="w-full bg-transparent border-none focus:ring-0 text-xs sm:text-sm py-1.5 px-2 text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {isSearching && (
                  <div className="pr-3">
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  </div>
                )}
              </div>
              
              {/* Dropdown Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#111827] rounded-xl shadow-xl ring-1 ring-black/5 overflow-hidden max-h-60 overflow-y-auto z-[9999]">
                  {suggestions.map((place, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 last:border-none text-xs sm:text-sm transition-colors cursor-pointer group"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(place);
                      }}
                      onClick={() => handleSelectSuggestion(place)}
                    >
                      <div className="text-gray-900 dark:text-white font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {place.display_name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSuggestions && searchQuery.length >= 3 && suggestions.length === 0 && !isSearching && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#111827] rounded-xl shadow-lg ring-1 ring-black/5 p-3 text-center text-sm text-red-500 font-medium z-[9999]">
                  Location not found
                </div>
              )}
            </div>
            <div className="absolute top-4 right-4 z-[400] flex flex-col items-end gap-2">
                <button 
                 type="button"
                 onClick={detectLocation}
                 disabled={isDetectingLocation}
                 className="bg-white dark:bg-[#0f172a] px-3 py-1.5 rounded-lg shadow-sm text-sm font-bold text-gray-800 dark:text-gray-200 border border-transparent dark:border-gray-700 flex items-center gap-2 transition-colors duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
               >
                  {isDetectingLocation ? (
                     <>
                        <Loader2 className="w-4 h-4 text-red-500 animate-spin"/> Locating...
                     </>
                  ) : (
                     <>
                        <MapPin className="w-4 h-4 text-red-500"/> Detect Location
                     </>
                  )}
               </button>
               {locationError && (
                 <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm flex items-center justify-center border border-red-100 dark:border-red-800">
                   {locationError}
                 </div>
               )}
            </div>
            <div className="w-full h-full rounded-xl overflow-hidden relative z-0">
               <MapView 
                  issues={[]} 
                  selectedIssueCenter={location ? [location.lat, location.lng] : null} 
                  onLocationSelect={(lat, lng) => setLocation({lat, lng})}
               />
            </div>
          </motion.div>

          {/* Input Form Section */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/70 dark:bg-[#1e293b]/70 backdrop-blur-md shadow-sm border border-white dark:border-gray-700 rounded-2xl p-6 transition-colors duration-300 relative"
          >
            {successMessage && (
               <div className="mb-6 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-4 rounded-xl text-sm font-bold border border-green-200 dark:border-green-800 flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300">
                 <span className="text-xl">✅</span> {successMessage}
               </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Image Upload Area */}
              <div className="space-y-4">
                <div 
                  onClick={() => images.length < 5 && fileInputRef.current?.click()}
                  className={`w-full h-[120px] border-2 border-dashed rounded-xl bg-gray-50 dark:bg-[#0a0f1e] transition-colors flex flex-col items-center justify-center relative overflow-hidden ${
                     images.length >= 5 
                        ? 'border-gray-200 dark:border-gray-800 opacity-60 cursor-not-allowed' 
                        : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#111827] cursor-pointer hover:text-blue-500 text-gray-500 dark:text-gray-400 group'
                  }`}
                >
                  <Camera className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-sm">Take or Upload Photos (Max 5)</span>
                  <input 
                    type="file" 
                    multiple
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleImageChange} 
                    disabled={images.length >= 5}
                  />
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {images.map(img => (
                      <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 group">
                        {img.isUploading && (
                          <div className="absolute inset-0 bg-black/60 z-10 flex flex-col items-center justify-center text-white backdrop-blur-sm transition-all">
                            <Loader2 className="w-5 h-5 mb-1.5 animate-spin text-blue-500" />
                            <span className="text-[10px] font-semibold text-center px-1 leading-tight">{img.uploadProgressText}</span>
                          </div>
                        )}
                        <img src={img.preview} alt="Preview" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" />
                        {!img.isUploading && (
                           <button
                             type="button"
                             onClick={(e) => handleRemoveImage(e, img.id)}
                             title="Remove image"
                             className="absolute top-1.5 right-1.5 bg-gray-900/60 hover:bg-red-600 text-white p-1 rounded-full backdrop-blur-sm transition-all z-20 shadow-sm opacity-90 hover:opacity-100"
                           >
                             <X className="w-3.5 h-3.5" />
                           </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Issue Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Huge Pothole on Main Street"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-[#00e5a0]/50 focus:border-[#00e5a0] outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Category</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] shadow-sm focus:ring-2 focus:ring-[#00e5a0]/50 focus:border-[#00e5a0] outline-none transition-all text-gray-700 dark:text-gray-200 appearance-none"
                  >
                    <option value="" disabled className="text-gray-400">Select the issue type (or auto-detect)</option>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 space-y-4">
                {formError && (
                  <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm font-medium border border-red-100 dark:border-red-800 flex items-center gap-2 transition-all">
                    <span>⚠️</span> {formError}
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold shadow-[0_4px_14px_rgba(34,197,94,0.3)] transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <>
                       <Loader2 className="w-5 h-5 animate-spin" />
                       Submitting...
                    </>
                  ) : (
                    <>
                       <Send className="w-5 h-5" />
                       Submit Issue
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
