import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, AlertCircle, XCircle, Send, Crosshair } from 'lucide-react';
import { auth, db, storage } from '../../config/firebase';
import { collection, doc, setDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CitizenScreenType } from './CitizenRouter';
import { reverseGeocode } from '../../utils/nominatim';
import CitizenHeader from '../../components/citizen/CitizenHeader';
import LocationPicker from '../../components/ui/LocationPicker';

interface ReportScreenProps {
  onNavigate: (screen: CitizenScreenType, reportId?: string) => void;
}

export default function ReportScreen({ onNavigate }: ReportScreenProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoAccuracy, setGeoAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('Detecting location...');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userAdjustedLocation, setUserAdjustedLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const gpsLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Location not supported by your browser.');
      setAddress('');
      return;
    }

    let watchId: number;
    let bestAccuracy = Infinity;
    let settled = false;

    const onSuccess = async (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = position.coords;

      gpsLocationRef.current = { lat: latitude, lng: longitude };
      setGeoAccuracy(accuracy);
      setLocationError(null);

      if (!userAdjustedLocation) {
        setLocation({ lat: latitude, lng: longitude });
      }

      if (accuracy < bestAccuracy) {
        bestAccuracy = accuracy;
        try {
          setAddress(await reverseGeocode(latitude, longitude));
        } catch {
          setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      }
    };

    const onError = () => {
      if (!settled) {
        setLocationError('Location not detected — please enable location access.');
      }
    };

    watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });

    return () => {
      settled = true;
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [userAdjustedLocation]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhoto(file);
      setPhotoUrl(URL.createObjectURL(file));
    }
  };

  const clearPhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(null);
    setPhotoUrl(null);
  };

  const handleLocationChange = (newLat: number, newLng: number) => {
    setLocation({ lat: newLat, lng: newLng });
    setUserAdjustedLocation(true);
    reverseGeocode(newLat, newLng)
      .then(setAddress)
      .catch(() => setAddress(`${newLat.toFixed(5)}, ${newLng.toFixed(5)}`));
  };

  const handleRecenter = () => {
    if (gpsLocationRef.current) {
      const { lat, lng } = gpsLocationRef.current;
      setLocation({ lat, lng });
      setUserAdjustedLocation(false);
      reverseGeocode(lat, lng)
        .then(setAddress)
        .catch(() => setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`));
    }
  };

  const handleSubmit = async () => {
    if (!photo || !location) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');

      await user.getIdToken(true);
      await new Promise((r) => setTimeout(r, 500));

      const tokenResult = await user.getIdTokenResult();
      if (tokenResult.claims.role !== 'citizen') {
        throw new Error('Your account does not have the citizen role. Please contact support.');
      }

      const reportRef = doc(collection(db, 'reports'));
      const reportId = reportRef.id;
      const ext = photo.name.split('.').pop() || 'jpg';
      const storageRef = ref(storage, `reports/${user.uid}/${reportId}/before.${ext}`);

      let downloadUrl: string;
      try {
        const uploadResult = await uploadBytes(storageRef, photo);
        downloadUrl = await getDownloadURL(uploadResult.ref);
      } catch {
        throw new Error('Photo upload failed. Please try again.');
      }

      const newReportData: Record<string, unknown> = {
        id: reportId,
        citizen_id: user.uid,
        category: '',
        severity: 'Low' as const,
        status: 'NEW',
        photo_url: downloadUrl,
        lat: location.lat,
        lng: location.lng,
        description: description.trim(),
        device_timestamp: Timestamp.now(),
        created_at: Timestamp.now(),
        updated_at: serverTimestamp(),
        affected_citizen_ids: [user.uid],
      };

      if (geoAccuracy != null) {
        newReportData.geo_accuracy_meters = geoAccuracy;
      } else {
        newReportData.geo_accuracy_unknown = true;
      }

      try {
        await setDoc(reportRef, newReportData);
      } catch {
        throw new Error('Failed to submit report. Please try again.');
      }

      onNavigate('submission-pending', reportId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setSubmitError(msg);
      setIsSubmitting(false);
    }
  };

  const isSubmitEnabled = !!photo && !!location && !isSubmitting;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-8 font-sans text-text-primary">
      <CitizenHeader showBack onBack={() => onNavigate('home')} title="New Report" subtitle="Document an issue to earn Hero XP!" />

      <main className="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 py-8">
        <section>
          {photoUrl ? (
            <div className="relative aspect-video overflow-hidden rounded-xl border-4 border-border shadow-[4px_4px_0_0_var(--cp-border)]">
              <img src={photoUrl} alt="Issue" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={clearPhoto}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-border text-white shadow-lg"
                aria-label="Remove photo"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="playful-dash group flex aspect-video w-full flex-col items-center justify-center bg-surface-container p-6 text-center"
            >
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4 border-border bg-primary-container shadow-[4px_4px_0_0_var(--cp-border)] transition-transform group-hover:scale-110">
                <Camera className="h-10 w-10 text-primary-dark" />
              </div>
              <h3 className="font-display text-xl font-semibold">Capture Evidence</h3>
              <p className="mt-2 px-4 text-base text-on-surface-variant">Take a photo to activate AI detection</p>
            </button>
          )}

          {!photoUrl && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="text-sm font-bold text-tertiary underline"
              >
                Upload from gallery
              </button>
            </div>
          )}

          <input type="file" accept="image/*" capture="environment" className="hidden" ref={fileInputRef} onChange={handlePhotoSelect} />
          <input type="file" accept="image/*" className="hidden" ref={galleryInputRef} onChange={handlePhotoSelect} />
        </section>

        <section className="space-y-2">
          <label htmlFor="description" className="ml-1 text-sm font-bold text-on-surface-variant">
            Report Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add some notes for the village council..."
            rows={3}
            className="w-full resize-none rounded-xl border-4 border-border bg-surface-container-lowest p-4 text-base shadow-[4px_4px_0_0_var(--cp-border)] outline-none focus:ring-0"
          />
        </section>

        <section className="space-y-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="ml-1 text-sm font-bold text-on-surface-variant">Current Coordinates</h2>
            <span className="flex items-center gap-1 text-sm font-bold text-primary">
              <Crosshair className="h-4 w-4" />
              {geoAccuracy != null
                ? `GPS ${geoAccuracy <= 10 ? '±10m' : geoAccuracy <= 30 ? '±30m' : geoAccuracy <= 100 ? '±100m' : '±100m+'}`
                : 'GPS'}
            </span>
          </div>

          {locationError ? (
            <div className="flex gap-3 rounded-xl border-2 border-border bg-severity-high-bg p-4 text-severity-high">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{locationError}</p>
            </div>
          ) : (
            <>
              {location && (
                <LocationPicker
                  lat={location.lat}
                  lng={location.lng}
                  onLocationChange={handleLocationChange}
                  onRecenter={handleRecenter}
                />
              )}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1.5 rounded-full border-2 border-border bg-surface-container-lowest px-3 py-1 shadow-[2px_2px_0_0_var(--cp-border)]">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="max-w-[220px] truncate text-xs font-bold">{address}</span>
                </div>
                {geoAccuracy != null && (
                  <div className={`flex items-center gap-1 rounded-full border-2 border-border px-2.5 py-1 text-xs font-bold shadow-[2px_2px_0_0_var(--cp-border)] ${
                    geoAccuracy <= 30
                      ? 'bg-status-success text-white'
                      : geoAccuracy <= 100
                        ? 'bg-status-warning text-white'
                        : 'bg-severity-high text-white'
                  }`}>
                    <Crosshair className="h-3 w-3" />
                    {geoAccuracy.toFixed(0)}m
                  </div>
                )}
              </div>
            </>
          )}
          {geoAccuracy != null && geoAccuracy > 30 && (
            <p className="text-xs text-on-surface-variant mt-1 ml-1">
              GPS accuracy improving — wait for the badge to turn green for best results
            </p>
          )}
        </section>

        {submitError && <p className="text-center text-sm font-medium text-severity-high">{submitError}</p>}

        <section className="pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isSubmitEnabled}
            className="neo-3d flex h-16 w-full items-center justify-center gap-3 rounded-xl border-4 border-border bg-primary font-display text-xl font-semibold text-text-inverse disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <Send className="h-6 w-6" />
                REPORT
              </>
            )}
          </button>
          <p className="mt-4 text-center text-xs italic text-on-surface-variant">
            +50 XP for verified reports. Heroes play by the rules.
          </p>
        </section>
      </main>
    </div>
  );
}
