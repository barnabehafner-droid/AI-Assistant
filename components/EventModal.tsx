import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent, GoogleCalendar, Project } from '../types';
import { XMarkIcon, TrashIcon, RectangleGroupIcon } from './icons';
// FIX: Import AllItemTypes from types.ts where it is exported, not from useOrganizerState.ts.
import { AllItemTypes } from '../types';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onSave: (eventData: Partial<CalendarEvent>, calendarId: string) => void;
  onDelete: (eventId: string, calendarId: string) => void;
  calendars: GoogleCalendar[];
  primaryCalendarId: string | null;
  defaultCalendarId: string | null;
  isLoggedIn: boolean;
  projects: Project[];
  onLinkItem: (projectId: string, itemType: AllItemTypes, itemId: string) => void;
  onUnlinkItem: (itemType: AllItemTypes, itemId: string) => void;
}

const reminderOptions = [
    { value: -1, label: 'Aucun rappel' },
    { value: 5, label: '5 minutes avant' },
    { value: 10, label: '10 minutes avant' },
    { value: 30, label: '30 minutes avant' },
    { value: 60, label: '1 heure avant' },
    { value: 1440, label: '1 jour avant' },
];

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, event, onSave, onDelete, calendars, primaryCalendarId, defaultCalendarId, isLoggedIn, projects, onLinkItem, onUnlinkItem }) => {
    const [summary, setSummary] = useState('');
    const [description, setDescription] = useState('');
    const [startDateTime, setStartDateTime] = useState('');
    const [endDateTime, setEndDateTime] = useState('');
    const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
    const [reminderMinutes, setReminderMinutes] = useState<number>(-1);
    const prevIsOpen = useRef(isOpen);


    const formatDateTimeForInput = (isoString?: string): string => {
        if (!isoString) return '';
        const date = new Date(isoString);
        // Adjust for timezone offset to display local time correctly in the input
        const tzOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - tzOffset);
        return localDate.toISOString().slice(0, 16);
    };

    useEffect(() => {
        // Only reset the form state when the modal is opening.
        // This prevents re-renders (e.g., from changing the reminder dropdown)
        // from overwriting the user's input with the initial prop values.
        if (isOpen && !prevIsOpen.current) {
            if (event) {
                setSummary(event.summary || '');
                setDescription(event.description || '');
                setStartDateTime(formatDateTimeForInput(event.start?.dateTime));
                setEndDateTime(formatDateTimeForInput(event.end?.dateTime));
                setSelectedCalendarId(event.calendarId || primaryCalendarId || '');
                const reminder = event.reminders?.overrides?.[0];
                setReminderMinutes(reminder ? reminder.minutes : -1);
            } else {
                const now = new Date();
                const startOfNextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);
                const endOfNextHour = new Date(startOfNextHour.getTime() + 60 * 60 * 1000);
                
                setSummary('');
                setDescription('');
                setStartDateTime(formatDateTimeForInput(startOfNextHour.toISOString()));
                setEndDateTime(formatDateTimeForInput(endOfNextHour.toISOString()));
                setSelectedCalendarId(defaultCalendarId || primaryCalendarId || (calendars[0]?.id || ''));
                setReminderMinutes(10); // Default to 10 minutes for new events
            }
        }
        prevIsOpen.current = isOpen;
    }, [event, isOpen, primaryCalendarId, calendars, defaultCalendarId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const eventData: Partial<CalendarEvent> = {
            summary,
            description,
            start: {
                dateTime: new Date(startDateTime).toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
                dateTime: new Date(endDateTime).toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            reminders: {
                useDefault: false,
                overrides: reminderMinutes > -1 ? [{ method: 'popup', minutes: reminderMinutes }] : [],
            },
        };
        onSave(eventData, selectedCalendarId);
    };

    const handleDelete = () => {
        if (event && event.id && window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) {
            onDelete(event.id, event.calendarId || '');
        }
    };
    
    if (!isOpen) return null;

    const project = event?.id ? projects.find(p => p.linkedItemIds.linkedEventIds?.includes(event.id)) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                <header className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-2xl font-bold text-slate-800">{event ? 'Modifier l\'événement' : 'Nouvel événement'}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
                    <div className="p-6 space-y-6">
                        <div>
                            <label htmlFor="summary" className="block text-sm font-medium text-slate-700 mb-1">Titre</label>
                            <input
                                id="summary"
                                type="text"
                                value={summary}
                                onChange={(e) => setSummary(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="start" className="block text-sm font-medium text-slate-700 mb-1">Début</label>
                                <input
                                    id="start"
                                    type="datetime-local"
                                    value={startDateTime}
                                    onChange={(e) => setStartDateTime(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                    required
                                />
                            </div>
                             <div>
                                <label htmlFor="end" className="block text-sm font-medium text-slate-700 mb-1">Fin</label>
                                <input
                                    id="end"
                                    type="datetime-local"
                                    value={endDateTime}
                                    onChange={(e) => setEndDateTime(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                    required
                                />
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="calendar-select" className="block text-sm font-medium text-slate-700 mb-1">Calendrier</label>
                                <select 
                                    id="calendar-select"
                                    value={selectedCalendarId}
                                    onChange={(e) => setSelectedCalendarId(e.target.value)}
                                    disabled={!!event || !isLoggedIn}
                                    className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition disabled:bg-slate-200 disabled:cursor-not-allowed"
                                >
                                    {calendars.length === 0 && <option value="">{isLoggedIn ? 'Aucun calendrier trouvé' : 'Connectez-vous pour choisir'}</option>}
                                    {calendars.map(cal => <option key={cal.id} value={cal.id}>{cal.summary}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="reminder-select" className="block text-sm font-medium text-slate-700 mb-1">Rappel</label>
                                <select 
                                    id="reminder-select"
                                    value={reminderMinutes}
                                    onChange={(e) => setReminderMinutes(parseInt(e.target.value, 10))}
                                    className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                >
                                    {reminderOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Ajouter des détails..."
                                rows={4}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                            />
                        </div>
                        {event?.id && (
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Projet</label>
                                {project ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 rounded-full px-3 py-1">
                                            <RectangleGroupIcon className="w-4 h-4" />
                                            <span className="font-semibold">{project.title}</span>
                                        </div>
                                        <button onClick={() => onUnlinkItem('event', event.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors" aria-label="Délier du projet">
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <select
                                        value=""
                                        onChange={(e) => { if (e.target.value) { onLinkItem(e.target.value, 'event', event.id); } }}
                                        className="max-w-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                    >
                                        <option value="" disabled>Lier à un projet...</option>
                                        {projects.map(p => (<option key={p.id} value={p.id}>{p.title}</option>))}
                                    </select>
                                )}
                            </div>
                        )}
                    </div>
                    <footer className="p-4 bg-slate-50 border-t flex justify-between items-center">
                        <div>
                            {event && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-semibold"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    Supprimer
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                             <button type="button" onClick={onClose} className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">
                                Annuler
                            </button>
                             <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                                Enregistrer
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    );
};

export default EventModal;
