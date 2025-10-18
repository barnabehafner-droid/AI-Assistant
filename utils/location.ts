export const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            }),
            () => resolve(null), // On error, resolve with null
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
        );
    });
};
