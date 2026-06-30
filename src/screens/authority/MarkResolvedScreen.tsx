import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Upload, AlertCircle } from 'lucide-react';
import { auth, db, storage } from '../../config/firebase';
import { doc, collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AuthorityScreenType } from './AuthorityRouter';
import Button from '../../components/ui/Button';

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
      } catch {
        setSubmitError('Could not load report details. Please go back and try again.');
      }
    };
    fetchReport();
  }, [clusterId]);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhoto(file);
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
      setSubmitError(null);
    }
  };

  const handleSubmit = async () => {
    if (!photo || !reportId) return;
    
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");

      // Force token refresh to get latest custom claims (role, etc.)
      await user.getIdToken(true);
      // Short delay to let the fresh token propagate to Firestore/Storage SDK internals
      await new Promise((r) => setTimeout(r, 500));

      // Pre-flight role check
      const tokenResult = await user.getIdTokenResult();
      if (tokenResult.claims.role !== 'authority') {
        throw new Error('Your account does not have the authority role. Please contact an administrator.');
      }

      const ext = photo.name.split('.').pop() || 'jpg';
      const storageRef = ref(storage, `reports/${reportId}/after.${ext}`);
      
      let downloadUrl: string;
      try {
        const uploadResult = await uploadBytes(storageRef, photo);
        downloadUrl = await getDownloadURL(uploadResult.ref);
      } catch (uploadErr) {
        const msg = uploadErr instanceof Error ? uploadErr.message : 'Unknown error';
        throw new Error(`Photo upload failed: ${msg}`);
      }

      const rQuery = query(collection(db, 'reports'), where('cluster_id', '==', clusterId));
      const rSnap = await getDocs(rQuery);
      const allReportIds = rSnap.docs.map((d) => d.id);

      const now = Timestamp.now();

      const baseUpdate = {
        status: 'RESOLVED' as const,
        after_photo_url: downloadUrl,
        authority_id: user.uid,
        updated_at: now,
      };

      const clusterUpdate = {
        status: 'resolved' as const,
        after_photo_url: downloadUrl,
        authority_id: user.uid,
        updated_at: now,
      };

      try {
        // Update reports first
        try {
          await Promise.all(
            allReportIds.map((id) => updateDoc(doc(db, 'reports', id), baseUpdate))
          );
        } catch (e) {
          const m = e instanceof Error ? e.message : 'Unknown';
          throw new Error(`reports update: ${m}`);
        }

        // Then update cluster
        try {
          await updateDoc(doc(db, 'clusters', clusterId), clusterUpdate);
        } catch (e) {
          const m = e instanceof Error ? e.message : 'Unknown';
          throw new Error(`cluster update: ${m}`);
        }

        // Then create event
        try {
          await addDoc(collection(db, 'report_events'), {
            event_type: 'work_completed',
            report_id: reportId,
            cluster_id: clusterId,
            authority_id: user.uid,
            after_photo_url: downloadUrl,
            created_at: serverTimestamp()
          });
        } catch (e) {
          const m = e instanceof Error ? e.message : 'Unknown';
          throw new Error(`report_events create: ${m}`);
        }
      } catch (dbErr) {
        const msg = dbErr instanceof Error ? dbErr.message : 'Unknown error';
        setSubmitError(msg);
        setIsSubmitting(false);
        return;
      }

      onNavigate('resolution-submitted');
      
    } catch (err) {
      console.error('Resolution submit failed', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSubmitError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-text-primary font-sans pb-8">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center border-b border-border bg-surface px-4 sticky top-0 z-10 shadow-sm">
        <Button 
          variant="icon"
          onClick={() => onNavigate('issue-detail', clusterId)} 
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-section-title ml-2">Mark as Resolved</h1>
      </header>

      <main className="flex-1 p-6 max-w-lg mx-auto w-full space-y-6">
        <p className="text-body-lg text-text-secondary">
          Upload a photo showing the issue has been fixed. This will be sent to the affected citizens for confirmation.
        </p>

        {/* Before Photo Ref */}
        {beforePhotoUrl && (
          <div className="flex items-center gap-4 p-3 bg-surface border border-border rounded-xl shadow-sm">
            <div className="h-16 w-16 bg-background rounded-lg overflow-hidden shrink-0">
              <img src={beforePhotoUrl} alt="Before" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-semibold text-text-primary text-body-md">Before Photo</p>
              <p className="text-caption text-text-secondary">Reference of the original issue</p>
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
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-sm border border-border bg-background group">
              <img src={photoUrl} alt="After" className="w-full h-full object-cover" />
              {!isSubmitting && (
                <button 
                  onClick={() => { if (photoUrl) URL.revokeObjectURL(photoUrl); setPhoto(null); setPhotoUrl(null); }}
                  className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white px-3 py-1.5 rounded-full text-caption font-medium hover:bg-black/80 transition"
                >
                  Change Photo
                </button>
              )}
            </div>
          ) : (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 w-full aspect-[4/3] bg-surface border-2 border-dashed border-border rounded-2xl hover:border-primary hover:bg-primary/5 transition text-text-secondary group"
            >
              <div className="h-14 w-14 bg-background group-hover:bg-primary/10 rounded-full flex items-center justify-center transition">
                <Camera className="h-7 w-7 text-text-secondary group-hover:text-primary transition" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-text-primary group-hover:text-primary">Take After Photo</p>
                <p className="text-caption mt-1">Camera or Gallery</p>
              </div>
            </button>
          )}
        </section>

        {submitError && (
          <div className="p-4 bg-severity-high-bg text-severity-high rounded-xl border border-severity-high/20 text-body-md font-medium flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{submitError}</p>
          </div>
        )}
      </main>

      {/* Footer / Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSubmit}
            disabled={!photo || isSubmitting || !reportId}
            fullWidth
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
          </Button>
        </div>
      </div>
    </div>
  );
}
