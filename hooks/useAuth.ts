import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserProfile } from '../types';
import { auth } from '../services/firebase';
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    User
} from 'firebase/auth';

export const useAuth = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);

    const isLoggedIn = !!profile && !!accessToken;

    const invalidateAccessToken = useCallback(() => {
        localStorage.removeItem('google_access_token');
        setAccessToken(null);
    }, []);

    const signOut = useCallback(async () => {
        try {
            await firebaseSignOut(auth);
            invalidateAccessToken(); // Use the new centralized invalidation
            setProfile(null);
        } catch (error) {
            console.error("Error signing out with Firebase:", error);
        }
    }, [invalidateAccessToken]);
    
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
            if (user) {
                // User is signed in via Firebase session.
                const userProfile: UserProfile = {
                    name: user.displayName || '',
                    email: user.email || '',
                    picture: user.photoURL || '',
                    given_name: user.displayName?.split(' ')[0] || '',
                    family_name: user.displayName?.split(' ').slice(1).join(' ') || '',
                };
                setProfile(userProfile);

                // Try to get token from local storage to persist across sessions
                const storedToken = localStorage.getItem('google_access_token');
                if (storedToken) {
                    setAccessToken(storedToken);
                } else {
                    console.warn("Firebase user found, but no Google API access token in local storage. Some features may require signing in again.");
                }
            } else {
                // User is signed out.
                if (isLoggedIn) { // Prevent unnecessary calls on initial load
                    signOut();
                }
            }
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, [signOut, isLoggedIn]);

    const signIn = useCallback(async () => {
        const provider = new GoogleAuthProvider();
        // Add all necessary scopes for Google APIs
        provider.addScope('https://www.googleapis.com/auth/drive.appdata');
        provider.addScope('https://www.googleapis.com/auth/userinfo.email');
        provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
        provider.addScope('https://www.googleapis.com/auth/calendar');
        provider.addScope('https://www.googleapis.com/auth/gmail.modify');
        provider.addScope('https://www.googleapis.com/auth/gmail.send');
        provider.addScope('https://www.googleapis.com/auth/gmail.compose');
        provider.addScope('https://www.googleapis.com/auth/contacts');
        provider.addScope('https://www.googleapis.com/auth/fitness.activity.read');

        try {
            const result = await signInWithPopup(auth, provider);
            
            // This gives you a Google Access Token needed for Google API calls.
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;

            if (token) {
                setAccessToken(token);
                // Use localStorage for the token to persist across browser sessions.
                localStorage.setItem('google_access_token', token);
            }
            // The onAuthStateChanged listener will handle setting the profile.

        } catch (error) {
            console.error("Firebase sign-in error:", error);
        }
    }, []);

    return useMemo(() => ({
        profile,
        accessToken,
        isLoggedIn,
        signIn,
        signOut,
        invalidateAccessToken,
    }), [profile, accessToken, isLoggedIn, signIn, signOut, invalidateAccessToken]);
};