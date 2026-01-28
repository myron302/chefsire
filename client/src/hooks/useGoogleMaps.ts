import { useEffect, useState } from 'react';

// Global flags to prevent multiple loads
let googleMapsLoaded = false;
let googleMapsLoadPromise: Promise<void> | null = null;

/**
 * Load Google Maps API script dynamically via backend proxy
 * This fetches the API key from /api/google/maps-script to keep it secure
 */
function loadGoogleMapsAPI(): Promise<void> {
  if (googleMapsLoaded) {
    return Promise.resolve();
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    // Fetch the API key from backend
    fetch('/api/google/maps-script')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to get Maps API key');
        return res.text();
      })
      .then((apiKey) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          console.log('[useGoogleMaps] Google Maps API loaded successfully');
          googleMapsLoaded = true;
          resolve();
        };

        script.onerror = () => {
          console.error('[useGoogleMaps] Failed to load Google Maps API');
          googleMapsLoadPromise = null;
          reject(new Error('Failed to load Google Maps API'));
        };

        document.head.appendChild(script);
      })
      .catch((err) => {
        console.error('[useGoogleMaps] Error fetching API key:', err);
        googleMapsLoadPromise = null;
        reject(err);
      });
  });

  return googleMapsLoadPromise;
}

/**
 * Hook to load Google Maps JavaScript API with Places library
 * @returns boolean indicating if the API is loaded
 */
export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already loaded
    if (window.google?.maps?.places) {
      setIsLoaded(true);
      return;
    }

    // Load the API
    loadGoogleMapsAPI()
      .then(() => {
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error('[useGoogleMaps] Failed to load:', err);
        setError(err.message);
      });
  }, []);

  return isLoaded;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: any;
          PlacesService: any;
        };
        Map?: any;
        Marker?: any;
        LatLng?: any;
        LatLngBounds?: any;
        InfoWindow?: any;
      };
    };
  }
}
