import { useState, useEffect } from 'react';

// Declare process.env for TypeScript since Vite will define it at build time.
declare var process: {
  env: {
    API_KEY: string;
  }
};

export const useGoogleMaps = () => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        // FIX: Cast window to any to access google.maps, which may not be on the window type.
        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
            setIsLoaded(true);
            return;
        }

        const existingScript = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);

        if (existingScript) {
            const checkInterval = setInterval(() => {
                // FIX: Cast window to any to access google.maps, which may not be on the window type.
                if ((window as any).google && (window as any).google.maps && (window as any).google.maps.places) {
                    setIsLoaded(true);
                    clearInterval(checkInterval);
                }
            }, 100);

            // Cleanup function for interval
            return () => clearInterval(checkInterval);
        }

        const script = document.createElement('script');
        // Use the unified API_KEY from process.env
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.API_KEY}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => setIsLoaded(true);
        script.onerror = () => setError(new Error('Failed to load Google Maps script.'));
        
        document.head.appendChild(script);
        
    }, []);

    return { isLoaded, error };
};