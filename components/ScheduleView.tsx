import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import * as googleCalendarService from '../services/googleCalendarService';
// FIX: Removed unused imports for Project, AllItemTypes, and EventModal to clean up the code and resolve the import error.
import { CalendarEvent, GoogleCalendar } from '../types';
import { LoaderIcon, PlusIcon, ChevronDownIcon } from './icons';

const createMockEvents = (): CalendarEvent[] => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(today.getDate() + 2);

    const formatToIso = (date: Date, hours: number, minutes: number) => {
        const d = new Date(date);
        d.setHours(hours, minutes, 0, 0);
        return d.toISOString();
    };

    return [
        {
            id: 'mock1', summary: 'Réunion de projet', description: 'Discussion sur les prochaines étapes.',
            start: { dateTime: formatToIso(today, 10, 0) }, end: { dateTime: formatToIso(today, 11, 0) },
            backgroundColor: '#039be5', // blue
        },
        {
            id: 'mock2', summary: 'Déjeuner avec l\'équipe',
            start: { dateTime: formatToIso(today, 12, 30) }, end: { dateTime: formatToIso(today, 13, 30) },
             backgroundColor: '#33b679', // green
        },
    ];
};

interface CalendarWidgetProps {
    auth: ReturnType<typeof useAuth>;
    events: CalendarEvent[];
    isLoading: boolean;
    onRefresh: () => void;
    calendars: GoogleCalendar[];
    defaultCalendarId: string | null;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onOpenEvent: (event: CalendarEvent | null) => void;
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ auth, events: eventsFromProps, isLoading, onRefresh, calendars, defaultCalendarId, isCollapsed, onToggleCollapse, onOpenEvent }) => {
    // The value is now derived directly from props within the render logic.
    const displayEvents = !auth.isLoggedIn ? createMockEvents() : eventsFromProps;


    const handleOpenModal = (event: CalendarEvent | null) => {
        if (!auth.isLoggedIn && !event) {
            auth.signIn();
            return;
        }
        onOpenEvent(event);
    };
    
    const groupEventsByDay = (eventList: CalendarEvent[]) => {
        const groups: { [key: string]: CalendarEvent[] } = {};
        const displayLimit = isCollapsed ? 5 : 20;
        (eventList || []).slice(0, displayLimit).forEach(event => {
            const startDate = event.start?.dateTime || event.start?.date;
            if (startDate) {
                const day = startDate.split('T')[0];
                if (!groups[day]) {
                    groups[day] = [];
                }
                groups[day].push(event);
            }
        });
        return groups;
    };

    const renderEventTime = (event: CalendarEvent) => {
        const { start } = event;
        if (start.date) {
            return <span className="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Jour entier</span>;
        }
        if (start.dateTime) {
            return new Date(start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }
        return '';
    };

    const formatDateHeader = (dateString: string) => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const eventDate = new Date(dateString);
        
        today.setHours(0,0,0,0);
        tomorrow.setHours(0,0,0,0);
        eventDate.setHours(0,0,0,0);

        if (eventDate.getTime() === today.getTime()) return 'Aujourd\'hui';
        if (eventDate.getTime() === tomorrow.getTime()) return 'Demain';
        
        return eventDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric' });
    };

    const groupedEvents = groupEventsByDay(displayEvents);
    const sortedDays = Object.keys(groupedEvents).sort();

    const renderCollapsedSummary = () => {
        if (isLoading) {
            return <LoaderIcon className="w-6 h-6 text-slate-400" />;
        }
    
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
    
        const nextEventToday = displayEvents.find(event => {
            const eventStartStr = (event.start?.dateTime || event.start?.date || '').split('T')[0];
            const eventStartTime = new Date(event.start?.dateTime || 0);
            return eventStartStr === todayStr && eventStartTime > now;
        });
    
        if (nextEventToday && nextEventToday.start.dateTime) {
            const time = new Date(nextEventToday.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            return <span>Prochain à {time}</span>;
        }
    
        return <span>Aucun nouvel événement aujourd'hui</span>;
    };

    return (
        <div className="bg-white rounded-xl shadow-md p-6 flex flex-col">
            <header className={`flex justify-between items-center pb-2 ${!isCollapsed ? 'mb-4 border-b' : ''}`}>
                <h2 className="text-2xl font-bold text-slate-800">Planning</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleOpenModal(null)}
                        className="flex items-center justify-center w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        aria-label="Ajouter un événement"
                    >
                        <PlusIcon className="w-5 h-5" />
                    </button>
                    <button onClick={onToggleCollapse} className="p-1 text-slate-400 hover:text-slate-600">
                        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                    </button>
                </div>
            </header>
            
            {isCollapsed ? (
                <div className="py-4 h-16 flex items-center justify-center text-center text-slate-600 font-medium">
                    {renderCollapsedSummary()}
                </div>
            ) : (
                <div className="flex-grow overflow-y-auto max-h-[450px] pr-2 -mr-2">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full py-10">
                            <LoaderIcon className="w-8 h-8 text-indigo-600" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sortedDays.length > 0 ? sortedDays.map(day => (
                                <section key={day}>
                                    <h3 className="text-sm font-bold text-slate-600 sticky top-0 bg-white pt-2 pb-1">
                                        {formatDateHeader(day)}
                                    </h3>
                                    <ul className="space-y-2">
                                        {groupedEvents[day].map(event => (
                                            <li key={event.id} onClick={() => handleOpenModal(event)} className="p-3 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors cursor-pointer">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex items-start gap-2 min-w-0">
                                                        <span style={{ backgroundColor: event.backgroundColor }} className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"></span>
                                                        <span className="font-bold text-slate-800 text-sm truncate">{event.summary}</span>
                                                    </div>
                                                    <span className="text-xs text-indigo-600 font-semibold flex-shrink-0">{renderEventTime(event)}</span>
                                                </div>
                                                {event.description && <p className="text-slate-500 text-xs mt-1 truncate">{event.description}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )) : (
                                <div className="text-center py-10 h-full flex flex-col justify-center items-center">
                                    <p className="text-slate-500">Aucun événement à venir.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {!auth.isLoggedIn && !isCollapsed && (
                <div className="text-center text-xs text-slate-400 pt-3 border-t border-slate-100 mt-3">
                    Données de démonstration. <button onClick={auth.signIn} className="font-semibold text-indigo-500 hover:underline">Connectez-vous</button> pour voir votre calendrier.
                </div>
            )}
        </div>
    );
};

export default CalendarWidget;
