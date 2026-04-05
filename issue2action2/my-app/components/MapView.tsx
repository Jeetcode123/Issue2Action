import { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useRouter } from 'next/navigation';

// Fix Leaflet Default Icon Path Issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom markers with animated pulse
const createPulseIcon = (bgClasses: string, dotClasses: string, sizeClass = 'w-8 h-8', borderClass = 'w-4 h-4') => {
  return L.divIcon({
    className: 'bg-transparent border-0',
    html: `
      <div class="relative flex w-6 h-6 justify-center items-center group">
        <span class="animate-ping absolute inline-flex ${sizeClass} rounded-full opacity-50 ${bgClasses}"></span>
        <span class="relative inline-flex rounded-full ${borderClass} shadow-lg ${dotClasses} border-[1.5px] border-white dark:border-gray-900 mix-blend-screen"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const icons = {
  red: createPulseIcon('bg-red-400', 'bg-red-500'),
  redHotspot: createPulseIcon('bg-red-400', 'bg-red-500', 'w-20 h-20 bg-red-500/60', 'w-6 h-6'),
  yellow: createPulseIcon('bg-yellow-400', 'bg-yellow-500'),
  green: createPulseIcon('bg-green-400', 'bg-green-500'),
};

const getIcon = (status: string, upvotes = 0) => {
  const s = (status || '').toLowerCase();
  if (s === 'resolved' || s === 'closed') return icons.green;
  if (s === 'in progress' || s === 'in_progress' || s === 'assigned') return icons.yellow;
  if (upvotes >= 5) return icons.redHotspot;
  return icons.red; // pending or reported
};

// Component to handle flying to selected issue
function MapController({ center, zoom, userLoc }: { center: [number, number] | null; zoom: number, userLoc: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1.5 });
    }
  }, [center, zoom, map]);

  useEffect(() => {
    if (userLoc) {
      map.flyTo(userLoc, 15, { duration: 1.5 });
    }
  }, [userLoc, map]);

  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function DraggableMarker({ position, onDragEnd }: { position: [number, number], onDragEnd: (lat: number, lng: number) => void }) {
  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          onDragEnd(latlng.lat, latlng.lng);
        }
      },
    }),
    [onDragEnd],
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={icons.red}
    >
      <Popup minWidth={90}>
        <div className="font-medium text-sm">Drag to adjust location</div>
      </Popup>
    </Marker>
  );
}

export default function MapView({ issues, selectedIssueCenter, onLocationSelect }: { issues: any[], selectedIssueCenter: [number, number] | null, onLocationSelect?: (lat: number, lng: number) => void }) {
  const router = useRouter();
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);

  const locateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLoc([pos.coords.latitude, pos.coords.longitude]);
          if (onLocationSelect) {
            onLocationSelect(pos.coords.latitude, pos.coords.longitude);
          }
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
    }
  };

  const currentCenterId = selectedIssueCenter ? `${selectedIssueCenter[0]}-${selectedIssueCenter[1]}` : 'none';

  // Find a default center based on the first issue if no selected issue exists
  const defaultCenter = (issues && issues.length > 0 && issues[0].latitude && issues[0].longitude) 
    ? [parseFloat(issues[0].latitude), parseFloat(issues[0].longitude)]
    : [28.6139, 77.2090]; // Default New Delhi

  return (
    <div className="relative w-full h-full">
      <MapContainer 
        center={(selectedIssueCenter || defaultCenter) as [number, number]} 
        zoom={selectedIssueCenter ? 15 : 12} 
        className="w-full h-full z-0" 
        zoomControl={false}
      >
        <TileLayer
          attribution='&amp;copy <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <ZoomControl position="topright" />
        
        <MapController 
          center={selectedIssueCenter} 
          zoom={15} 
          userLoc={userLoc}
        />

        <MapClickHandler onMapClick={onLocationSelect} />

        {onLocationSelect && selectedIssueCenter && (
          <DraggableMarker 
            position={selectedIssueCenter} 
            onDragEnd={onLocationSelect} 
          />
        )}

        {issues && issues.map((issue) => {
          if (!issue.latitude || !issue.longitude) return null;
          return (
             <Marker 
                key={issue.id} 
                position={[parseFloat(issue.latitude), parseFloat(issue.longitude)]}
                icon={getIcon(issue.status, issue.upvotes)}
             >
                <Popup className="custom-popup border-none">
                   <div className="min-w-[220px] -m-3 p-4 bg-white dark:bg-[#0f172a] rounded-xl shadow-lg border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-3">
                         <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                           (issue.status || '').toLowerCase() === 'resolved' || (issue.status || '').toLowerCase() === 'closed' ? 'bg-green-100 text-green-700 border-green-200' :
                           (issue.status || '').toLowerCase() === 'in progress' || (issue.status || '').toLowerCase() === 'assigned' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                           'bg-red-100 text-red-700 border-red-200'
                         }`}>
                            {issue.status}
                         </span>
                         <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md">
                            👍 {issue.upvotes || 0}
                         </span>
                      </div>
                      <h3 className="font-bold text-gray-900 dark:text-white mb-1.5 line-clamp-1">{issue.type || issue.category || 'General'} Issue</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                        {issue.description || issue.location_text || 'No description provided.'}
                      </p>
                      <button 
                        onClick={(e) => { e.preventDefault(); router.push(`/track?id=${issue.id}`); }}
                        className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-[0_4px_10px_rgba(79,70,229,0.3)] hover:shadow-[0_6px_14px_rgba(79,70,229,0.4)] hover:-translate-y-0.5"
                      >
                         Track Issue
                      </button>
                   </div>
                </Popup>
             </Marker>
          );
        })}
      </MapContainer>

      {/* Legend Overlay */}
      <div className="absolute top-6 left-6 z-[1000] bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-md p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-gray-800 transition-all duration-300">
         <h4 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Live Status
         </h4>
         <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" style={{animationDuration: '1.5s'}}></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] border-[1.5px] border-white dark:border-gray-800"></span>
               </span>
               Pending
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
               <span className="relative flex h-3 w-3">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" style={{animationDuration: '2s'}}></span>
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)] border-[1.5px] border-white dark:border-gray-800"></span>
               </span>
               In Progress
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
               <span className="relative flex h-3 w-3">
                 <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] border-[1.5px] border-white dark:border-gray-800"></span>
               </span>
               Resolved
            </div>
         </div>
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-3">
        <button 
          onClick={(e) => { e.preventDefault(); locateMe(); }}
          className="p-3 bg-white text-gray-700 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.15)] hover:bg-gray-50 hover:text-blue-600 transition flex items-center justify-center group relative"
          title="Locate Me"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
             Locate Me
          </div>
        </button>
      </div>

      {/* Report Here Button Overlay */}
      {!onLocationSelect && (
        <div className="absolute bottom-6 left-6 z-[1000]">
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (userLoc) {
                router.push(`/report?lat=${userLoc[0]}&lng=${userLoc[1]}`);
              } else {
                 if (navigator.geolocation) {
                   navigator.geolocation.getCurrentPosition(
                     (pos) => router.push(`/report?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`),
                     () => router.push('/report')
                   );
                 } else {
                   router.push('/report');
                 }
              }
            }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-full shadow-[0_4px_12px_rgba(79,70,229,0.3)] hover:shadow-[0_6px_16px_rgba(79,70,229,0.4)] hover:-translate-y-0.5 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Report Here
          </button>
        </div>
      )}
    </div>
  );
}
