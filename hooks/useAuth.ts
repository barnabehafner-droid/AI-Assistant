import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';

declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;

export const useAuth = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [tokenClient, setTokenClient] = useState<any>(null);
    
    const isLoggedIn = !!profile && !!accessToken;

    const signOut = useCallback(() => {
        // Use the stored token for revocation in case state hasn't updated
        const token = localStorage.getItem('google_access_token');
        if (token && window.google?.accounts?.oauth2) {
            window.google.accounts.oauth2.revoke(token, () => {});
        }
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expires');
        setAccessToken(null);
        setProfile(null);
    }, []);

    const fetchProfile = useCallback(async (token: string) => {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch profile');
            const userProfile: UserProfile = await response.json();
            setProfile(userProfile);
        } catch (error) {
            console.error("Error fetching user profile:", error);
            signOut();
        }
    }, [signOut]);

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) {
            console.error("Google Client ID is not configured.");
            return;
        }

        const script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
        
        const initializeAndCheckAuth = () => {
             const client = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/contacts.readonly',
                callback: (tokenResponse: any) => {
                    // This callback handles both interactive sign-in and silent refresh.
                    if (tokenResponse && tokenResponse.access_token) {
                        const expiresIn = (tokenResponse.expires_in || 3600) * 1000;
                        const expiryTime = Date.now() + expiresIn;
                        localStorage.setItem('google_access_token', tokenResponse.access_token);
                        localStorage.setItem('google_token_expires', expiryTime.toString());
                        setAccessToken(tokenResponse.access_token);
                        fetchProfile(tokenResponse.access_token);
                    }
                },
                error_callback: (error: any) => {
                    // This is for interactive flow errors. Silent refresh failures don't trigger this.
                    console.error('Google Auth Error:', error);
                }
            });
            setTokenClient(client);

            // Check for a stored token.
            const storedToken = localStorage.getItem('google_access_token');
            const storedExpiry = localStorage.getItem('google_token_expires');

            if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry, 10)) {
                // Token is valid and exists, use it.
                setAccessToken(storedToken);
                fetchProfile(storedToken);
            } else if (storedToken) {
                // Token exists but is expired. Attempt a silent refresh.
                // If it succeeds, the callback will fire. If it fails, nothing happens,
                // and the user remains in a logged-out state, which is correct.
                client.requestAccessToken({ prompt: 'none' });
            }
            // If no storedToken exists, the user is logged out. We do nothing and wait for them to sign in.
        };
        
        if (window.google) {
            initializeAndCheckAuth();
        } else if (script) {
            script.onload = initializeAndCheckAuth;
        }

    }, [fetchProfile]);

    const signIn = useCallback(() => {
        if (tokenClient) {
            // For a user-initiated sign-in, we want the prompt to show if necessary.
            // An empty prompt is the default and correct for this.
            tokenClient.requestAccessToken({ prompt: '' });
        } else {
            // This might happen if the user clicks sign-in before the GSI script loads.
            // We could queue the request, but logging an error is simpler for now.
            console.error("Google token client not initialized. Cannot sign in.");
        }
    }, [tokenClient]);

    return {
        profile,
        accessToken,
        isLoggedIn,
        signIn,
        signOut,
    };
};
