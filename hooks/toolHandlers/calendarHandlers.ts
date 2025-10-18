import { ToolHandler, ToolHandlerContext } from './types';
import * as googleCalendarService from '../../services/googleCalendarService';
import { getTravelTime } from '../../services/googleMapsService';
import { getCurrentLocation } from '../../utils/location';
import { findBestMatch } from '../../utils/fuzzyMatching';
import { CalendarEvent } from '../../types';

export const createCalendarHandlers = (context: ToolHandlerContext): Record<string, ToolHandler> => {
    // FIX: Destructure calendarEvents from context to use cached data instead of making a new API call.
    const { auth, defaultCalendarIdRef, refreshCalendar, calendarEvents, organizer } = context;

    // FIX: Refactor to be synchronous and use in-memory calendarEvents for performance.
    const checkForCalendarConflicts = (args: { startTime: string, endTime: string }): string => {
        const startTime = new Date(args.startTime).getTime();
        const endTime = new Date(args.endTime).getTime();

        const conflictingEvents = calendarEvents.filter(event => {
            const eventStartStr = event.start?.dateTime || event.start?.date;
            const eventEndStr = event.end?.dateTime || event.end?.date;
            if (!eventStartStr || !eventEndStr) return false;

            const eventStart = new Date(eventStartStr).getTime();
            const eventEnd = new Date(eventEndStr).getTime();
            
            // Check for overlap: max(start1, start2) < min(end1, end2)
            return Math.max(startTime, eventStart) < Math.min(endTime, eventEnd);
        });

        if (conflictingEvents.length > 0) {
            const eventTitles = conflictingEvents.map(e => `"${e.summary}"`).join(', ');
            return `Oui, il y a un conflit. Vous avez déjà les événements suivants : ${eventTitles}.`;
        }
        return "Non, ce créneau est libre.";
    };

    const createCalendarEvent = async (args: { summary: string, startTime: string, endTime: string }): Promise<string> => {
        if (!auth.accessToken) return "Désolé, vous devez être connecté à Google pour créer un événement.";
        const calendarId = defaultCalendarIdRef.current || 'primary';
        try {
            await googleCalendarService.createEvent(auth.accessToken, calendarId, {
                summary: args.summary,
                start: { dateTime: args.startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
                end: { dateTime: args.endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            });
            refreshCalendar();
            return `OK, j'ai ajouté l'événement "${args.summary}" à votre agenda.`;
        } catch (error) {
            console.error("Error creating calendar event:", error);
            return "Désolé, une erreur est survenue lors de la création de l'événement.";
        }
    };

    const modifyCalendarEvent = async (args: { eventIdentifier: string, newStartTime?: string, newEndTime?: string, newSummary?: string }): Promise<string> => {
        if (!auth.accessToken) return "Désolé, vous devez être connecté à Google pour modifier un événement.";

        const eventToModify = findBestMatch(calendarEvents, args.eventIdentifier, 'summary');

        if (!eventToModify || !eventToModify.id || !eventToModify.calendarId) {
            return `Désolé, je n'ai pas trouvé d'événement ressemblant à "${args.eventIdentifier}".`;
        }
        
        const updateData: Partial<CalendarEvent> = {};
        
        if (args.newSummary) {
            updateData.summary = args.newSummary;
        }

        if (args.newStartTime) {
            const newStart = new Date(args.newStartTime);
            updateData.start = { ...eventToModify.start, dateTime: newStart.toISOString() };

            // If only start time changes, adjust end time to keep the same duration
            if (!args.newEndTime && eventToModify.start?.dateTime && eventToModify.end?.dateTime) {
                try {
                    const originalDuration = new Date(eventToModify.end.dateTime).getTime() - new Date(eventToModify.start.dateTime).getTime();
                    if (originalDuration > 0) {
                        const newEnd = new Date(newStart.getTime() + originalDuration);
                        updateData.end = { ...eventToModify.end, dateTime: newEnd.toISOString() };
                    }
                } catch (e) {
                    console.warn("Could not calculate event duration to adjust end time automatically.", e);
                }
            }
        }
        
        // If an explicit end time is provided, it takes precedence
        if (args.newEndTime) {
            updateData.end = { ...eventToModify.end, dateTime: new Date(args.newEndTime).toISOString() };
        }

        if (Object.keys(updateData).length === 0) {
            return "Veuillez spécifier ce que vous voulez modifier (titre, heure de début ou de fin).";
        }
        
        try {
            await googleCalendarService.updateEvent(auth.accessToken, eventToModify.calendarId, eventToModify.id, updateData);
            refreshCalendar();
            const finalSummary = updateData.summary || eventToModify.summary;
            return `OK, j'ai mis à jour l'événement "${finalSummary}".`;
        } catch (error) {
            console.error("Error updating calendar event:", error);
            return "Désolé, une erreur est survenue lors de la modification de l'événement.";
        }
    };

    const calculateTravelTimeToNextEvent = async (): Promise<string> => {
        const now = new Date();
        const upcomingEvents = calendarEvents
            .filter(e => e.start?.dateTime && new Date(e.start.dateTime) > now)
            .sort((a, b) => new Date(a.start.dateTime!).getTime() - new Date(b.start.dateTime!).getTime());

        if (upcomingEvents.length === 0) {
            return "Vous n'avez aucun événement à venir dans votre agenda.";
        }

        const nextEvent = upcomingEvents[0];
        if (!nextEvent.location) {
            return `Votre prochain événement, "${nextEvent.summary}", n'a pas de lieu renseigné. Je ne peux donc pas calculer le temps de trajet.`;
        }

        const userLocation = await getCurrentLocation();
        if (!userLocation) {
            return "Je n'ai pas pu obtenir votre position actuelle pour calculer le temps de trajet.";
        }

        try {
            const travelMode = organizer.voiceSettings.transportMode || 'DRIVING';
            const travelInfo = await getTravelTime(userLocation, nextEvent.location, travelMode);
            if (!travelInfo) {
                return `Désolé, je n'ai pas pu calculer l'itinéraire jusqu'à "${nextEvent.location}".`;
            }

            const eventStartTime = new Date(nextEvent.start.dateTime!);
            const travelDurationSeconds = travelInfo.durationInSeconds;
            
            const departureTime = new Date(eventStartTime.getTime() - travelDurationSeconds * 1000);
            const timeToLeaveInMinutes = Math.round((departureTime.getTime() - now.getTime()) / 60000);

            let departureMessage: string;
            if (timeToLeaveInMinutes <= 0) {
                departureMessage = "Vous devriez déjà être parti !";
            } else if (timeToLeaveInMinutes < 60) {
                departureMessage = `Vous devriez partir dans environ ${timeToLeaveInMinutes} minute${timeToLeaveInMinutes > 1 ? 's' : ''}.`;
            } else {
                const hours = Math.floor(timeToLeaveInMinutes / 60);
                const minutes = timeToLeaveInMinutes % 60;
                departureMessage = `Vous devriez partir dans environ ${hours} heure${hours > 1 ? 's' : ''}${minutes > 0 ? ` et ${minutes} minutes` : ''}.`;
            }

            return `Le trajet jusqu'à "${nextEvent.summary}" à "${nextEvent.location}" dure environ ${travelInfo.durationText}. ${departureMessage}`;
        } catch (error) {
            console.error("Error calculating travel time:", error);
            return `Désolé, une erreur est survenue lors du calcul du temps de trajet pour "${nextEvent.summary}".`;
        }
    };

    return {
        checkForCalendarConflicts,
        createCalendarEvent,
        modifyCalendarEvent,
        calculateTravelTimeToNextEvent,
    };
};