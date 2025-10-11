import React, { useState } from 'react';
import { VoiceSettings, GoogleCalendar } from '../types';
import { XMarkIcon, SparklesIcon, LoaderIcon } from './icons';
import { rewriteCustomInstruction, analyzeWritingStyle } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onUpdateSettings: (newSettings: Partial<VoiceSettings>) => void;
  calendars: GoogleCalendar[];
  defaultCalendarId: string | null;
  onSetDefaultCalendarId: (id: string) => void;
  onAnalyzeStyle: () => Promise<void>;
  visibleCalendarIds: string[];
  onUpdateVisibleCalendars: (ids: string[]) => void;
}

const voices: VoiceSettings['voiceName'][] = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdateSettings, calendars, defaultCalendarId, onSetDefaultCalendarId, onAnalyzeStyle, visibleCalendarIds, onUpdateVisibleCalendars }) => {
  const [isRewriting, setIsRewriting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  if (!isOpen) return null;

  const handleRewriteInstruction = async () => {
    if (!settings.customInstruction.trim()) return;
    setIsRewriting(true);
    try {
        const rewrittenText = await rewriteCustomInstruction(settings.customInstruction);
        onUpdateSettings({ customInstruction: rewrittenText });
    } catch (error) {
        console.error("Failed to rewrite instruction", error);
        alert("Sorry, I couldn't rewrite the instruction at this time.");
    } finally {
        setIsRewriting(false);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    await onAnalyzeStyle();
    setIsAnalyzing(false);
  };

  const handleVisibleCalendarToggle = (calendarId: string) => {
    const newVisibleIds = visibleCalendarIds.includes(calendarId)
        ? visibleCalendarIds.filter(id => id !== calendarId)
        : [...visibleCalendarIds, calendarId];
    onUpdateVisibleCalendars(newVisibleIds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4 flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-slate-800">Assistant Settings</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 overflow-y-auto space-y-8">
          {/* Voice Settings */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-700">Voice Output</h3>
            <div>
              <label htmlFor="voice-select" className="block text-sm font-medium text-slate-700 mb-2">
                Assistant Voice
              </label>
              <select
                id="voice-select"
                value={settings.voiceName}
                onChange={(e) => onUpdateSettings({ voiceName: e.target.value as VoiceSettings['voiceName'] })}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
              >
                {voices.map(voice => (
                  <option key={voice} value={voice}>{voice}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Personality Settings */}
          <div className="space-y-6 pt-6 border-t">
             <h3 className="text-lg font-semibold text-slate-700">Assistant Personality</h3>
             <div>
                <label htmlFor="tone" className="block text-sm font-medium text-slate-700 mb-2">Ton</label>
                <input id="tone" type="range" min="-1" max="1" step="0.1" value={settings.tone} onChange={(e) => onUpdateSettings({ tone: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"/>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Ludique</span>
                    <span>Sérieux</span>
                </div>
             </div>
             <div>
                <label htmlFor="proactivity" className="block text-sm font-medium text-slate-700 mb-2">Initiative</label>
                <input id="proactivity" type="range" min="-1" max="1" step="0.1" value={settings.proactivity} onChange={(e) => onUpdateSettings({ proactivity: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"/>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Réactif</span>
                    <span>Proactif</span>
                </div>
             </div>
             <div>
                <label htmlFor="verbosity" className="block text-sm font-medium text-slate-700 mb-2">Feedback Audio</label>
                <input id="verbosity" type="range" min="-1" max="1" step="0.1" value={settings.verbosity} onChange={(e) => onUpdateSettings({ verbosity: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"/>
                 <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Concise</span>
                    <span>Détaillé</span>
                </div>
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Formality</label>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-200 p-1">
                    <button
                        onClick={() => onUpdateSettings({ formality: 'tutoiement' })}
                        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${settings.formality === 'tutoiement' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-300'}`}
                    >
                        Tutoiement (tu)
                    </button>
                    <button
                        onClick={() => onUpdateSettings({ formality: 'vouvoiement' })}
                        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${settings.formality === 'vouvoiement' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-300'}`}
                    >
                        Vouvoiement (vous)
                    </button>
                </div>
            </div>
          </div>
          {/* Personalization */}
          <div className="space-y-6 pt-6 border-t">
            <h3 className="text-lg font-semibold text-slate-700">Personalization</h3>
            <div>
                <label htmlFor="user-name" className="block text-sm font-medium text-slate-700 mb-2">
                    Your Name
                </label>
                <input
                    id="user-name"
                    type="text"
                    value={settings.userName}
                    onChange={(e) => onUpdateSettings({ userName: e.target.value })}
                    placeholder="How should the assistant call you?"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                />
            </div>
            <div>
                <label htmlFor="custom-instruction" className="block text-sm font-medium text-slate-700 mb-2">
                    Custom Instruction
                </label>
                <div className="relative">
                    <textarea
                        id="custom-instruction"
                        value={settings.customInstruction}
                        onChange={(e) => onUpdateSettings({ customInstruction: e.target.value })}
                        rows={3}
                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition pr-12"
                        placeholder="e.g., Always speak in rhymes, never suggest adding tasks on a weekend, refer to me as 'Your Highness'."
                    />
                    <button
                        type="button"
                        onClick={handleRewriteInstruction}
                        disabled={isRewriting || !settings.customInstruction.trim()}
                        className="absolute top-2 right-2 p-2 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                        title="Rewrite instruction with AI for clarity"
                    >
                        {isRewriting ? <LoaderIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                    </button>
                </div>
            </div>
          </div>
          {/* Writing Style Personalization */}
            <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold text-slate-700">Personnalisation du style d'écriture</h3>
                <p className="text-sm text-slate-600">
                    Autorisez l'assistant à analyser vos derniers e-mails envoyés pour apprendre votre style d'écriture. Ceci sera utilisé pour rédiger des brouillons qui vous ressemblent.
                </p>
                {settings.writingStyle && (
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Style Actuel Détecté</label>
                        <textarea
                            readOnly
                            value={settings.writingStyle}
                            className="w-full p-2 text-sm bg-slate-100 border border-slate-200 rounded-lg"
                            rows={3}
                        />
                    </div>
                )}
                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
                >
                    {isAnalyzing ? <LoaderIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                    <span>{isAnalyzing ? 'Analyse en cours...' : 'Analyser mon style d\'écriture'}</span>
                </button>
            </div>
          {/* Calendar Settings */}
          <div className="space-y-6 pt-6 border-t">
            <h3 className="text-lg font-semibold text-slate-700">Paramètres du Calendrier</h3>
            <div>
              <label htmlFor="calendar-default" className="block text-sm font-medium text-slate-700 mb-2">
                Calendrier par défaut pour les nouveaux événements
              </label>
              <select
                id="calendar-default"
                value={defaultCalendarId || ''}
                onChange={(e) => onSetDefaultCalendarId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                disabled={calendars.length === 0}
              >
                {calendars.length === 0 && <option value="">Connectez-vous pour voir vos calendriers</option>}
                {calendars.map(cal => (
                  <option key={cal.id} value={cal.id}>{cal.summary}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Calendriers à afficher
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto p-3 border rounded-md bg-slate-50">
                {calendars.length > 0 ? calendars.map(cal => (
                  <div key={cal.id} className="flex items-center">
                    <input
                      id={`cal-vis-${cal.id}`}
                      type="checkbox"
                      checked={visibleCalendarIds.includes(cal.id)}
                      onChange={() => handleVisibleCalendarToggle(cal.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor={`cal-vis-${cal.id}`} className="ml-2 flex items-center gap-2 text-sm text-slate-900">
                        <span style={{ backgroundColor: cal.backgroundColor }} className="w-3 h-3 rounded-full flex-shrink-0"></span>
                        {cal.summary}
                    </label>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">Connectez-vous pour voir vos calendriers.</p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Les calendriers sélectionnés seront affichés dans le widget et utilisés par l'IA. Si aucun n'est sélectionné, seul le calendrier principal sera utilisé.
              </p>
            </div>
          </div>
        </div>
        <footer className="p-4 bg-slate-50 border-t flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
            Done
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;