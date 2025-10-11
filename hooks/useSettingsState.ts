import { useState, useEffect } from 'react';
import { VoiceSettings } from '../types';

const SETTINGS_KEY = 'ai-organizer-voice-settings';

const defaultSettings: VoiceSettings = {
  voiceName: 'Zephyr',
  tone: 0,
  proactivity: 0,
  verbosity: 0,
  customInstruction: '',
  formality: 'tutoiement',
  userName: '',
};

export const useSettingsState = () => {
    const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            // Merge saved settings with defaults to ensure new settings are applied
            const savedParsed = saved ? JSON.parse(saved) : {};
            return { ...defaultSettings, ...savedParsed };
        } catch (e) {
            console.error("Failed to parse voice settings from localStorage", e);
            return defaultSettings;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(voiceSettings));
        } catch (e) {
            console.error("Failed to save voice settings to localStorage", e);
        }
    }, [voiceSettings]);

    const updateVoiceSettings = (newSettings: Partial<VoiceSettings>) => {
        setVoiceSettings(prev => ({ ...prev, ...newSettings }));
    };

    return { voiceSettings, updateVoiceSettings };
};