import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { auth, db, storage } from '../../config/firebase';
import { doc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AuthorityScreenType } from './AuthorityRouter';

interface MarkResolvedScreenProps {
  clusterId: string;
  onNavigate: (screen: AuthorityScreenType, clusterId?: string) => void;
}

export default function MarkResolvedScreen({ clusterId, onNavigate }: MarkResolvedScreenProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [beforePhotoUrl, setBeforePhotoUrl] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const rQuery = query(collection(db, 'reports'), where('cluster_id', '==', clusterId));
        const rSnap = await getDocs(rQuery);
        if (!rSnap.empty) {
          setBeforePhotoUrl(rSnap.docs[0].data().photo_url);
          setReportId(rSnap.docs[0].id);
        }
      } catch (err) {
        console.error("Error fetching before photo:", err);
      }
    };
    fetchReport();
  }, [clusterId]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setPhoto(file);
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
      setSubmitError(null);
    }
  };

  const handleSimulatePhoto = async () => {
    try {
      const res = await fetch('https://source.unsplash.com/800x600/?street,clean');
      const blob = await res.blob();
      const file = new File([blob], 'after.jpg', { type: 'image/jpeg' });
      setPhoto(file);
      setPhotoUrl(URL.createObjectURL(file));
      setSubmitError(null);
    } catch (error) {
      console.error("Could not fetch sample image:", error);
    }
  };

  const handleSubmit = async () => {
    if (!photo || !reportId) return;
    
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");

      // 1. Upload photo to Cloud Storage
      const ext = photo.name.split('.').pop() || 'jpg';
      const storageRef = ref(storage, `reports/${reportId}/after.${ext}`);
      
      const uploadResult = await uploadBytes(storageRef, photo);
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      // 2. Create report_event in Firestore
      // (This will trigger CF3)
      await addDoc(collection(db, 'report_events'), {
        event_type: 'work_completed',
        report_id: reportId,
        cluster_id: clusterId,
        authority_id: user.uid,
        after_photo_url: downloadUrl,
        created_at: serverTimestamp()
      });

      // 3. Navigate to success screen
      onNavigate('resolution-submitted');
      
    } catch (error) {
      console.error("Submission failed:", error);
      setSubmitError("Photo upload failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F6F9] text-zinc-900 font-sans pb-8">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center border-b border-zinc-200 bg-white px-4 sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => onNavigate('issue-detail', clusterId)} 
          className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 transition"
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight ml-2">Mark as Resolved</h1>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full space-y-6">
        <p className="text-zinc-600 text-[16px]">
          Upload a photo showing the issue has been fixed. This will be sent to the affected citizens for confirmation.
        </p>

        {/* Before Photo Ref */}
        {beforePhotoUrl && (
          <div className="flex items-center gap-4 p-3 bg-white border border-zinc-200 rounded-xl shadow-sm">
            <div className="h-16 w-16 bg-zinc-100 rounded-lg overflow-hidden shrink-0">
              <img src={beforePhotoUrl} alt="Before" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-sm">Before Photo</p>
              <p className="text-xs text-zinc-500">Reference of the original issue</p>
            </div>
          </div>
        )}
        
        {/* Photo Upload Section */}
        <section className="space-y-4">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handlePhotoSelect}
          />

          {photoUrl ? (
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-sm border border-zinc-200 bg-zinc-100 group">
              <img src={photoUrl} alt="After" className="w-full h-full object-cover" />
              {!isSubmitting && (
                <button 
                  onClick={() => { setPhoto(null); setPhotoUrl(null); }}
                  className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white px-3 py-1.5 rounded-full text-sm font-medium hover:bg-black/80 transition"
                >
                  Change Photo
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 w-full aspect-[4/3] bg-white border-2 border-dashed border-zinc-300 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition text-zinc-500 group"
              >
                <div className="h-14 w-14 bg-zinc-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center transition">
                  <Camera className="h-7 w-7 text-zinc-400 group-hover:text-blue-600 transition" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-zinc-700 group-hover:text-blue-700">Take After Photo</p>
                  <p className="text-sm mt-1">Camera or Gallery</p>
                </div>
              </button>

              <button 
                onClick={handleSimulatePhoto}
                className="flex items-center justify-center gap-2 w-full py-4 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition text-zinc-600 font-medium text-sm shadow-sm"
              >
                <ImageIcon className="h-4 w-4" />
                Simulate with Unsplash Image
              </button>
            </div>
          )}
        </section>

        {submitError && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm font-medium flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{submitError}</p>
          </div>
        )}
      </main>

      {/* Footer / Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 p-4 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!photo || isSubmitting || !reportId}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-zinc-300 disabled:text-zinc-500 text-white font-bold rounded-xl flex justify-center items-center gap-2 transition"
          >
            {isSubmitting ? (
              <>
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Submit Resolution
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
