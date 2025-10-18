import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CalendarEvent, GoogleCalendar, VoiceSettings, DirectionsInfo } from '../types';
import { LoaderIcon, PlusIcon, ChevronDownIcon, GripVerticalIcon, MapPinIcon, CarIcon } from './icons';

const createMockEvents = (): CalendarEvent[] => {
    return [];
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
    isReordering?: boolean;
    currentUserCoordinates: { latitude: number; longitude: number } | null;
    voiceSettings: VoiceSettings;
    fetchAndCacheTravelInfo: (event: CalendarEvent) => Promise<DirectionsInfo | null>;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ auth, events: eventsFromProps, isLoading, onRefresh, calendars, defaultCalendarId, isCollapsed, onToggleCollapse, onOpenEvent, isReordering, currentUserCoordinates, voiceSettings, fetchAndCacheTravelInfo }) => {
    const displayEvents = !auth.isLoggedIn ? createMockEvents() : eventsFromProps;
    const [travelInfo, setTravelInfo] = useState<{ eventId: string; departureMessage: string } | null>(null);

    useEffect(() => {
        if (!eventsFromProps || eventsFromProps.length === 0 || !currentUserCoordinates) {
            setTravelInfo(null);
            return;
        }

        const now = new Date();
        const nextEventWithLocation = eventsFromProps.find(
            e => e.location && e.start?.dateTime && new Date(e.start.dateTime) > now
        );

        if (nextEventWithLocation) {
            fetchAndCacheTravelInfo(nextEventWithLocation)
                .then(directionsInfo => {
                    if (directionsInfo && directionsInfo.durationInSeconds && nextEventWithLocation.start.dateTime) {
                        const eventStartTime = new Date(nextEventWithLocation.start.dateTime);
                        const departureTime = new Date(eventStartTime.getTime() - directionsInfo.durationInSeconds * 1000);
                        
                        const isToday = eventStartTime.toDateString() === now.toDateString();
                        let departureMessage = '';

                        if (isToday) {
                            const minutesToLeave = Math.round((departureTime.getTime() - now.getTime()) / 60000);
                            if (minutesToLeave <= 0) {
                                departureMessage = 'Partir maintenant';
                            } else {
                                departureMessage = `Partir dans ${minutesToLeave} min`;
                            }
                        } else {
                            const timeString = departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                            departureMessage = `Partir avant ${timeString}`;
                        }
                        
                        setTravelInfo({
                            eventId: nextEventWithLocation.id,
                            departureMessage: departureMessage,
                        });
                    } else {
                        setTravelInfo(null);
                    }
                })
                .catch(err => {
                    console.warn("Could not calculate travel time for widget:", err);
                    setTravelInfo(null);
                });
        } else {
            setTravelInfo(null);
        }

    }, [eventsFromProps, currentUserCoordinates, fetchAndCacheTravelInfo]);


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
        <div className={`bg-white rounded-xl shadow-md p-6 flex flex-col ${isReordering ? 'widget-reordering-active' : ''}`}>
            <header className={`flex justify-between items-center pb-2 ${!isCollapsed ? 'mb-4 border-b' : ''}`}>
                <div onClick={onToggleCollapse} className="flex items-center gap-2 cursor-pointer">
                    {isReordering && !isCollapsed && <GripVerticalIcon className="w-5 h-5 text-slate-400" />}
                    <h2 className="text-2xl font-bold text-slate-800">Planning</h2>
                    <ChevronDownIcon className={`w-5 h-5 transition-transform text-slate-400 ${isCollapsed ? '' : 'rotate-180'}`} />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleOpenModal(null)}
                        className="flex items-center justify-center w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                        aria-label="Ajouter un événement"
                    >
                        <PlusIcon className="w-5 h-5" />
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
                                    <ul className="space-y-2 mt-1">
                                        {groupedEvents[day].map(event => (
                                            <li key={event.id}>
                                                <button onClick={() => onOpenEvent(event)} className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-slate-100 transition-colors">
                                                    <div className="w-1.5 h-auto self-stretch rounded-full" style={{ backgroundColor: event.backgroundColor || '#9ca3af' }}></div>
                                                    <div className="flex-grow text-left min-w-0">
                                                        <p className="font-semibold text-slate-800 text-sm truncate">{event.summary}</p>
                                                        {travelInfo && travelInfo.eventId === event.id ? (
                                                            <p className="text-xs text-purple-600 font-bold truncate flex items-center gap-1">
                                                                <CarIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                                                {travelInfo.departureMessage}
                                                            </p>
                                                        ) : event.location && (
                                                            <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                                                                <MapPinIcon className="w-3 h-3 flex-shrink-0" />
                                                                {event.location}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-slate-500 text-sm font-medium flex-shrink-0">
                                                        {renderEventTime(event)}
                                                    </div>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )) : (
                                <div className="text-center py-10 h-full flex flex-col justify-center items-center">
                                    <p className="text-slate-500">
                                        {auth.isLoggedIn ? "Votre agenda est vide pour les 60 prochains jours." : "Connectez-vous pour voir votre agenda."}
                                    </p>
                                    {!auth.isLoggedIn && (
                                        <button onClick={auth.signIn} className="mt-4 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg text-sm">
                                            Se connecter à Google
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};