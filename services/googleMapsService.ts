import { DirectionsInfo, InfoCard } from '../types';

let directionsServiceInstance: any = null;
const getDirectionsService = (): any => {
    if (!directionsServiceInstance) {
        if ((window as any).google && (window as any).google.maps && (window as any).google.maps.DirectionsService) {
            directionsServiceInstance = new (window as any).google.maps.DirectionsService();
        } else {
            // Let the caller handle this; they might be waiting for the API to load.
            return null;
        }
    }
    return directionsServiceInstance;
};

export const findNearbyStore = async (
    latitude: number,
    longitude: number,
    itemType: string,
    itemName: string
// FIX: Replace google.maps.places.PlaceResult with 'any' to avoid type errors when @types/google.maps is not found.
): Promise<any | null> => {
    // FIX: Cast window to any to access google.maps, which may not be on the window type.
    if (!(window as any).google || !(window as any).google.maps || !(window as any).google.maps.places) {
        throw new Error("Google Maps API not loaded.");
    }
    
    // FIX: Cast window to any to access google.maps, which may not be on the window type.
    const location = new (window as any).google.maps.LatLng(latitude, longitude);
    // FIX: Cast window to any to access google.maps, which may not be on the window type.
    const service = new (window as any).google.maps.places.PlacesService(document.createElement('div'));
    
    // FIX: Replace google.maps.places.PlaceSearchRequest with 'any' to avoid type errors.
    const request: any = {
        location: location,
        // FIX: Access RankBy via window.google to avoid 'Cannot find name' error at compile time.
        rankBy: (window as any).google.maps.places.RankBy.DISTANCE,
        keyword: itemName,
        type: itemType,
    };
    
    return new Promise((resolve, reject) => {
        service.nearbySearch(request, (results: any, status: any) => {
            // FIX: Cast window to any to access google.maps, which may not be on the window type.
            if (status === (window as any).google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                const openStore = results.find((r: any) => r.opening_hours?.open_now);
                resolve(openStore || results[0]);
            // FIX: Cast window to any to access google.maps, which may not be on the window type.
            } else if (status === (window as any).google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                // Fallback: broaden search if typed search fails
                // FIX: Replace google.maps.places.PlaceSearchRequest with 'any' to avoid type errors.
                const fallbackRequest: any = {
                    location: location,
                    // FIX: Access RankBy via window.google to avoid 'Cannot find name' error at compile time.
                    rankBy: (window as any).google.maps.places.RankBy.DISTANCE,
                    keyword: itemName,
                };
                service.nearbySearch(fallbackRequest, (fallbackResults: any, fallbackStatus: any) => {
                     // FIX: Cast window to any to access google.maps, which may not be on the window type.
                     if (fallbackStatus === (window as any).google.maps.places.PlacesServiceStatus.OK && fallbackResults && fallbackResults.length > 0) {
                        const openStoreFallback = fallbackResults.find((r: any) => r.opening_hours?.open_now);
                        resolve(openStoreFallback || fallbackResults[0]);
                    } else {
                        resolve(null);
                    }
                });
            } else {
                reject(new Error(`PlacesService failed with status: ${status}`));
            }
        });
    });
};

export const getTravelTime = async (
    origin: { latitude: number; longitude: number; },
    destination: string,
    travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' = 'DRIVING'
): Promise<{ durationInSeconds: number; durationText: string; } | null> => {
    const directionsService = getDirectionsService();
    if (!directionsService) {
        throw new Error("Google Maps Directions API not loaded.");
    }
    
    const request: any = {
        origin: new (window as any).google.maps.LatLng(origin.latitude, origin.longitude),
        destination: destination,
        travelMode: (window as any).google.maps.TravelMode[travelMode],
    };

    return new Promise((resolve, reject) => {
        directionsService.route(request, (result: any, status: any) => {
            if (status === (window as any).google.maps.DirectionsServiceStatus.OK && result.routes.length > 0) {
                const leg = result.routes[0].legs[0];
                if (leg.duration) {
                    resolve({
                        durationInSeconds: leg.duration.value,
                        durationText: leg.duration.text,
                    });
                } else {
                    resolve(null);
                }
            } else if (status === (window as any).google.maps.DirectionsServiceStatus.ZERO_RESULTS) {
                resolve(null);
            } else {
                reject(new Error(`Directions service failed with status: ${status}`));
            }
        });
    });
};

export const getDirections = async (
    origin: { latitude: number; longitude: number; },
    destination: string,
    travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' = 'TRANSIT'
): Promise<DirectionsInfo | null> => {
    const directionsService = getDirectionsService();
    if (!directionsService) {
        throw new Error("Google Maps Directions API not loaded.");
    }

    const request: any = {
        origin: new (window as any).google.maps.LatLng(origin.latitude, origin.longitude),
        destination: destination,
        travelMode: (window as any).google.maps.TravelMode[travelMode],
        provideRouteAlternatives: false,
    };

    return new Promise((resolve, reject) => {
        directionsService.route(request, (result: any, status: any) => {
            if (status === (window as any).google.maps.DirectionsServiceStatus.OK && result.routes.length > 0) {
                const route = result.routes[0];
                const leg = route.legs[0];

                if (!leg || !leg.duration || !leg.steps) {
                    resolve(null);
                    return;
                }

                const info: DirectionsInfo = {
                    duration: leg.duration.text,
                    durationInSeconds: leg.duration.value,
                    summary: route.summary || leg.start_address,
                    steps: leg.steps.map((step: any) => ({
                        instructions: step.instructions,
                        duration: step.duration.text,
                        travel_mode: step.travel_mode,
                    })),
                };
                resolve(info);

            } else if (status === (window as any).google.maps.DirectionsServiceStatus.ZERO_RESULTS) {
                resolve(null);
            } else {
                reject(new Error(`Directions service failed with status: ${status}`));
            }
        });
    });
};