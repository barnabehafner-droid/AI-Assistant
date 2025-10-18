import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ArrowRightOnRectangleIcon, ChevronDownIcon, GoogleIcon, Cog6ToothIcon, ArrowPathIcon, ArrowsUpDownIcon, ArrowUturnLeftIcon } from './icons';

interface AuthProps {
    auth: ReturnType<typeof useAuth>;
    onOpenSettings: () => void;
    onRefresh: () => void;
    onStartReorder: () => void;
    isOnline: boolean;
    onOpenHistory: () => void;
}

const Auth: React.FC<AuthProps> = ({ auth, onOpenSettings, onRefresh, onStartReorder, isOnline, onOpenHistory }) => {
    const { profile, isLoggedIn, signIn, signOut } = auth;
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isLoggedIn) {
        return (
            <button
                onClick={signIn}
                className="flex items-center gap-2 px-4 py-2 rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 bg-white text-slate-600 hover:bg-slate-50 focus:ring-slate-400"
            >
                <GoogleIcon className="w-5 h-5" />
                <span className="font-semibold text-sm">Sign In</span>
            </button>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className="w-14 h-14 rounded-full shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                aria-label="Ouvrir le menu utilisateur"
            >
                <img src={profile.picture} alt="Profil utilisateur" className="w-full h-full rounded-full object-cover" />
            </button>
            {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-1 z-20 animate-fade-in-up">
                    <button 
                        onClick={() => { onStartReorder(); setIsDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                        <ArrowsUpDownIcon className="w-5 h-5" />
                        <span>Réorganiser la vue</span>
                    </button>
                    <button 
                        onClick={() => { onRefresh(); setIsDropdownOpen(false); }}
                        disabled={!isOnline}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowPathIcon className="w-5 h-5" />
                        <span>Actualiser</span>
                    </button>
                    <div className="my-1 h-px bg-slate-200"></div>
                     <button 
                        onClick={() => { onOpenHistory(); setIsDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                        <ArrowUturnLeftIcon className="w-5 h-5" />
                        <span>Historique</span>
                    </button>
                     <button 
                        onClick={() => { onOpenSettings(); setIsDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                        <Cog6ToothIcon className="w-5 h-5" />
                        <span>Assistant Settings</span>
                    </button>
                    <div className="my-1 h-px bg-slate-200"></div>
                    <button 
                        onClick={signOut}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                    >
                        <ArrowRightOnRectangleIcon className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default Auth;