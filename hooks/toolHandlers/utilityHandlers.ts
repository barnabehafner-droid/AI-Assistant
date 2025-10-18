import { ToolHandler, ToolHandlerContext } from './types';
import * as weatherService from '../../services/weatherService';

export const createUtilityHandlers = (context: ToolHandlerContext): Record<string, ToolHandler> => {
    const { organizer, setPendingDuplicate, pendingDuplicate, triggerHighlight } = context;

    const annulerDerniereAction = (): string => {
        return organizer.undoLastAction() || "Il n'y a aucune action à annuler.";
    };

    const confirmerAjoutElementDuplique = (): string => {
        if (pendingDuplicate) {
            const { type, content, listId } = pendingDuplicate;
            let newId;
            if (type === 'todos') newId = organizer.addTodo(content.task, content.priority)?.newId;
            else if (type === 'shopping') newId = organizer.addShoppingItem(content.item)?.newId;
            else if (type === 'custom' && listId) newId = organizer.addCustomListItem(listId, content.item)?.newId;
            triggerHighlight(newId);
            setPendingDuplicate(null);
            return "OK, je l'ai ajouté quand même.";
        }
        return "Il n'y avait rien à confirmer.";
    };

    const annulerAjoutElementDuplique = (): string => {
        setPendingDuplicate(null);
        return "D'accord, j'annule l'ajout.";
    };

    const getWeatherForLocation = async (args: { location?: string }): Promise<string> => {
        const locationQuery = args.location || organizer.voiceSettings.location;

        if (!locationQuery) {
            return "Veuillez spécifier une ville ou en définir une dans vos paramètres pour que je puisse vous donner la météo.";
        }
        
        try {
            const weather = await weatherService.getTodaysWeather(locationQuery);
            if (weather) {
                return `À ${weather.location}, la température est de ${weather.temperature} degrés et le temps est ${weather.condition}.`;
            }
            return `Désolé, je n'ai pas pu obtenir la météo pour ${locationQuery}.`;
        } catch (error) {
            console.error("Error getting weather in tool handler:", error);
            return `Désolé, une erreur est survenue lors de la récupération de la météo pour ${locationQuery}.`;
        }
    };

    return {
        annulerDerniereAction,
        confirmerAjoutElementDuplique,
        annulerAjoutElementDuplique,
        getWeatherForLocation,
    };
};