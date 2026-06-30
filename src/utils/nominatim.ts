const NOMINATIM_HEADERS = {
  'User-Agent': 'CivicPulse/1.0 (civicpulse@example.com)',
  Accept: 'application/json',
};

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
    { headers: NOMINATIM_HEADERS }
  );
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  const displayAddress = data.address?.road
    ? `${data.address.road}, ${data.address.city || data.address.town || data.address.suburb || ''}`
    : data.display_name;
  return displayAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
