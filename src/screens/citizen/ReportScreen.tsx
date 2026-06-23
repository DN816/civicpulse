import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, AlertCircle, ArrowLeft, UploadCloud, XCircle } from 'lucide-react';
import { auth, db, storage } from '../../config/firebase';
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CitizenScreenType } from './CitizenRouter';

interface ReportScreenProps {
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
}

export default function ReportScreen({ onNavigate }: ReportScreenProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [geoAccuracy, setGeoAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('Detecting location...');
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-detect GPS on mount
    if (!navigator.geolocation) {
      setLocationError("Location not supported by your browser.");
      setAddress('');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        setGeoAccuracy(accuracy);
        setLocationError(null);
        
        // Reverse geocoding via OpenStreetMap (Nominatim)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (!res.ok) throw new Error('Geocoding failed');
          const data = await res.json();
          // Provide a concise address label
          const displayAddress = data.address?.road 
            ? `${data.address.road}, ${data.address.city || data.address.town || data.address.suburb || ''}`
            : data.display_name;
          setAddress(displayAddress);
        } catch (error) {
          console.error("Geocoding error:", error);
          setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError("Location not detected — please enable location access.");
        setAddress('');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setPhoto(file);
      const objUrl = URL.createObjectURL(file);
      setPhotoUrl(objUrl);
    }
  };

  const handleSubmit = async () => {
    if (!photo || !location) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");

      // Generate a new report ID (Firestore document ID)
      const reportRef = doc(collection(db, 'reports'));
      const reportId = reportRef.id;

      // 1. Upload photo to Cloud Storage
      const ext = photo.name.split('.').pop() || 'jpg';
      const storageRef = ref(storage, `reports/${user.uid}/${reportId}/before.${ext}`);
      
      const uploadResult = await uploadBytes(storageRef, photo);
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      // 2. Create report document in Firestore
      // Fields must match what CF1 reads: top-level lat, lng, geo_accuracy_meters
      const newReportData = {
        citizen_id: user.uid,
        status: 'NEW',
        photo_url: downloadUrl,
        lat: location.lat,
        lng: location.lng,
        geo_accuracy_meters: geoAccuracy ?? 50,
        description: description.trim(),
        device_timestamp: Timestamp.now(),
        created_at: Timestamp.now(),
        affected_citizen_ids: [user.uid]
      };

      await setDoc(reportRef, newReportData);

      // 3. Navigate to pending screen
      onNavigate('submission-pending', reportId);

    } catch (error) {
      console.error("Submission failed:", error);
      setSubmitError("Photo upload failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  const isSubmitEnabled = !!photo && !!location && !isSubmitting;

  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 font-sans pb-8">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center border-b border-zinc-200 bg-white px-4 sticky top-0 z-10">
        <button onClick={() => onNavigate('home')} className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 transition">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight ml-2">Report a Problem</h1>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full space-y-8">
        
        {/* Photo Section */}
        <section className="space-y-3">
          <p className="font-semibold text-zinc-800">Take a photo of the civic issue.</p>
          
          <div className="w-full flex flex-col items-center">
            {photoUrl ? (
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-sm border border-zinc-200 bg-zinc-100">
                <img src={photoUrl} alt="Issue" className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setPhoto(null); setPhotoUrl(null); }}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="w-full space-y-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 bg-zinc-50 border-2 border-dashed border-zinc-300 rounded-2xl p-8 hover:bg-zinc-100 hover:border-zinc-400 transition"
                >
                  <Camera className="h-10 w-10 text-zinc-400" />
                  <span className="font-medium text-zinc-600">Take Photo</span>
                </button>
                <div className="text-center">
                  <button 
                    onClick={() => galleryInputRef.current?.click()}
                    className="text-blue-600 underline font-medium text-sm hover:text-blue-700"
                  >
                    Upload from gallery
                  </button>
                </div>
              </div>
            )}
            
            {/* Hidden inputs */}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              ref={fileInputRef}
              onChange={handlePhotoSelect}
            />
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={galleryInputRef}
              onChange={handlePhotoSelect}
            />
          </div>
        </section>

        {/* Location Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-zinc-500" />
            <h3 className="font-semibold text-zinc-800">Location</h3>
          </div>
          
          {locationError ? (
            <div className="flex gap-3 bg-red-50 text-red-700 p-4 rounded-xl border border-red-100">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{locationError}</p>
            </div>
          ) : (
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              <p className="text-sm text-zinc-700 font-medium">{address}</p>
              {location && (
                <p className="text-xs text-zinc-400 mt-1">
                  GPS: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Description Section */}
        <section className="space-y-3">
          <h3 className="font-semibold text-zinc-800">Description</h3>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue (optional)"
            className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition resize-none h-32"
          />
        </section>

        {/* Error State */}
        {submitError && (
          <div className="text-center text-sm font-medium text-red-600">
            {submitError}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!isSubmitEnabled}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
            isSubmitEnabled 
              ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]' 
              : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Uploading...
            </>
          ) : (
            <>
              <UploadCloud className="h-5 w-5" />
              Submit Report
            </>
          )}
        </button>

      </main>
    </div>
  );
}
