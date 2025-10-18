import { Type, FunctionDeclaration } from '@google/genai';
import { TodoItem, ShoppingItem, NoteItem, CustomList, VoiceSettings, CalendarEvent, Contact } from '../types';

// --- AI Context Formatting Helpers ---
export const formatTodosForAI = (items: TodoItem[]) => items.length === 0 ? "Aucune tâche." : items.map(i => `- "${i.task}" (priorité: ${i.priority}, état: ${i.completed ? 'terminé' : 'à faire'}${i.dueDate ? `, échéance: ${i.dueDate}` : ''})`).join('\n');
export const formatShoppingForAI = (items: ShoppingItem[]) => {
    if (items.length === 0) return "Aucun article.";
    return items.map(i => {
        const details = [];
        if (i.quantity) details.push(`qté: ${i.quantity}${i.unit || ''}`);
        if (i.store) details.push(`magasin: ${i.store}`);
        const detailsString = details.length > 0 ? ` (${details.join(', ')})` : '';
        return `- "${i.item}"${detailsString} (état: ${i.completed ? 'acheté' : 'à acheter'})`;
    }).join('\n');
};
export const formatNotesForAI = (items: NoteItem[]) => {
    if (items.length === 0) return "Aucune note.";
    // Fournir le contenu complet est crucial pour que l'IA puisse exécuter correctement la fonction 'modifierNote'.
    // L'identifiant aide l'IA à spécifier quelle note elle veut modifier.
    return items.map(i => {
        const plainTextContent = i.content.replace(/<[^>]*>?/gm, ' '); // Strip HTML for a cleaner identifier
        const identifier = plainTextContent.split(/\s+/).slice(0, 5).join(' ');
        return `- Note (identifiant: "${identifier}..."): \n---\n${i.content}\n---`;
    }).join('\n');
};
export const formatCustomListsForAI = (lists: CustomList[]) => lists.length === 0 ? "Aucune liste personnalisée." : lists.map(list => `### ${list.title}:\n${list.items.length > 0 ? list.items.map(i => `- "${i.text}" (état: ${i.completed ? 'complété' : 'à faire'})`).join('\n') : "Vide."}`).join('\n\n');

export const formatCalendarEventsForAI = (events: CalendarEvent[]): string => {
    if (events.length === 0) return "Aucun événement à venir.";

    const formatEvent = (event: CalendarEvent) => {
        const summary = event.summary;
        const location = event.location ? ` à "${event.location}"` : '';
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;
        if (!start) return `- "${summary}"${location} (date inconnue)`;
        
        const isAllDay = !!event.start?.date;
        const startDate = new Date(start);

        const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

        if (isAllDay) {
            return `- "${summary}"${location} (toute la journée le ${startDate.toLocaleDateString('fr-FR', dateOptions)})`;
        }
        
        const endDate = new Date(end || start);
        const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };

        const dateString = startDate.toLocaleDateString('fr-FR', dateOptions);
        const startTimeString = startDate.toLocaleTimeString('fr-FR', timeOptions);
        const endTimeString = endDate.toLocaleTimeString('fr-FR', timeOptions);
        
        if (startDate.toDateString() === endDate.toDateString()) {
             return `- "${summary}"${location} le ${dateString} de ${startTimeString} à ${endTimeString}`;
        } else {
            // Event spans multiple days
            const endDateString = endDate.toLocaleDateString('fr-FR', dateOptions);
            return `- "${summary}"${location} du ${dateString} à ${startTimeString} au ${endDateString} à ${endTimeString}`;
        }
    };

    // Slice to keep prompt reasonable
    return events.slice(0, 20).map(formatEvent).join('\n');
};

export const formatContactsForAI = (contacts: Contact[]): string => {
    if (contacts.length === 0) return "Aucun contact.";
    // Keep it concise for the prompt by taking a slice.
    return contacts.slice(0, 50).map(c => `- ${c.displayName} (${c.email})`).join('\n');
};


// --- System Instruction Builder ---
export const buildSystemInstruction = (settings: VoiceSettings, baseInstruction: string): string => {
  const personalityClauses = [];

  // Formality is a primary rule
  if (settings.formality === 'tutoiement') {
    personalityClauses.push("Tu dois TOUJOURS tutoyer l'utilisateur (utiliser 'tu'). C'est une règle absolue.");
  } else { // 'vouvoiement'
    personalityClauses.push("Tu dois TOUJOURS vouvoyer l'utilisateur (utiliser 'vous'). C'est une règle absolue.");
  }

  // User Name
  if (settings.userName) {
    personalityClauses.push(`L'utilisateur s'appelle ${settings.userName}. Adresse-toi à lui par son nom de temps en temps, de manière naturelle.`);
  }

  // Tone Instructions
  if (settings.tone <= -0.7) {
    personalityClauses.push("Adopte un ton très ludique et amical. Tu peux utiliser des analogies amusantes et un langage décontracté.");
  } else if (settings.tone > -0.7 && settings.tone < -0.2) {
    personalityClauses.push("Adopte un ton amical et encourageant.");
  } else if (settings.tone >= 0.7) {
    personalityClauses.push("Adopte un ton très formel, professionnel et concis. Sois direct et factuel.");
  } else if (settings.tone > 0.2 && settings.tone < 0.7) {
    personalityClauses.push("Adopte un ton professionnel et direct.");
  }

  // Proactivity Instructions
  if (settings.proactivity <= -0.7) {
    personalityClauses.push("Sois purement réactif. N'agis que si on te le demande explicitement. Ne fais aucune suggestion.");
  } else if (settings.proactivity > 0.7) {
    personalityClauses.push("Sois très proactif. Si tu vois une opportunité d'aider l'utilisateur en suggérant une prochaine étape logique, une amélioration, ou en posant une question pertinente, saisis-la.");
  }

  // Verbosity Instructions
  if (settings.verbosity <= -0.7) {
    personalityClauses.push("Tes confirmations verbales après une action doivent être très courtes, comme 'OK', 'Fait', ou 'C'est noté'.");
  } else if (settings.verbosity > 0.7) {
    personalityClauses.push("Confirme chaque action de manière détaillée en répétant ce que tu as fait pour que l'utilisateur soit absolument certain de l'action accomplie. Par exemple : 'Parfait, j'ai bien ajouté la tâche \"Nettoyer la cuisine\" à votre liste de choses à faire.'");
  }

  // Writing Style
  if (settings.writingStyle) {
    personalityClauses.push(`**Règle pour les e-mails :** Lorsque tu rédiges un e-mail, suis impérativement ce guide de style pour correspondre au style de l'utilisateur : "${settings.writingStyle}"`);
  }

  // Custom Instruction
  if (settings.customInstruction) {
    personalityClauses.push(`Instruction personnalisée de l'utilisateur : ${settings.customInstruction}`);
  }

  if (personalityClauses.length > 0) {
     return `${baseInstruction}\n\n**PERSONNALITÉ DE L'ASSISTANT:**\n${personalityClauses.join('\n')}`;
  }
  
  return baseInstruction;
};


// --- Function Declarations for AI ---
const calendarTools: FunctionDeclaration[] = [
    {
        name: 'checkForCalendarConflicts',
        description: "Vérifie s'il existe des événements existants dans l'agenda de l'utilisateur pendant une plage horaire spécifiée. DOIT être utilisé AVANT d'appeler `createCalendarEvent`.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                startTime: { type: Type.STRING, description: "L'heure de début au format ISO 8601 (ex: AAAA-MM-DDTHH:MM:SS)." },
                endTime: { type: Type.STRING, description: "L'heure de fin au format ISO 8601 (ex: AAAA-MM-DDTHH:MM:SS)." },
            },
            required: ['startTime', 'endTime'],
        },
    },
    {
        name: 'createCalendarEvent',
        description: "Crée un nouvel événement dans l'agenda Google de l'utilisateur. Utilise cette fonction après avoir vérifié les conflits ou si l'utilisateur a confirmé vouloir superposer des événements.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING, description: "Le titre de l'événement." },
                startTime: { type: Type.STRING, description: "L'heure de début au format ISO 8601." },
                endTime: { type: Type.STRING, description: "L'heure de fin au format ISO 8601." },
            },
            required: ['summary', 'startTime', 'endTime'],
        },
    },
    {
        name: 'modifyCalendarEvent',
        description: "Modifie un événement existant dans l'agenda. Utilise cette fonction si l'utilisateur demande de changer un événement suite à une détection de conflit.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                eventIdentifier: { type: Type.STRING, description: "Le titre ou une description de l'événement à modifier pour l'identifier." },
                newStartTime: { type: Type.STRING, description: "Optionnel. La nouvelle heure de début au format ISO 8601." },
                newEndTime: { type: Type.STRING, description: "Optionnel. La nouvelle heure de fin au format ISO 8601." },
                newSummary: { type: Type.STRING, description: "Optionnel. Le nouveau titre de l'événement." },
            },
            required: ['eventIdentifier'],
        },
    },
    {
        name: 'calculateTravelTimeToNextEvent',
        description: "Calcule le temps de trajet jusqu'au prochain événement de l'agenda et indique quand partir pour être à l'heure.",
        parameters: { type: Type.OBJECT, properties: {} },
    },
];

const gmailTools: FunctionDeclaration[] = [
    {
        name: 'rechercherEmails',
        description: "Recherche dans Gmail et affiche une liste de résultats à l'écran. Utilise cette fonction quand l'utilisateur veut voir plusieurs e-mails ou faire une recherche générale.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                requete: { type: Type.STRING, description: "La requête de recherche (ex: 'de:john.doe@example.com', 'sujet:facture', 'e-mails non lus')." },
            },
            required: ['requete'],
        },
    },
    {
        name: 'lireEmail',
        description: "Recherche et lit à voix haute le premier e-mail correspondant à une requête, ou le dernier e-mail reçu si aucune requête n'est fournie. Utilise cette fonction quand l'utilisateur veut entendre le contenu d'un e-mail spécifique.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                requeteRecherche: { type: Type.STRING, description: "Optionnel. Une requête de recherche pour trouver un e-mail spécifique (ex: 'de:john.doe', 'le dernier de jane', 'avec le sujet \"facture\"'). Si omis, le dernier e-mail de la boîte de réception sera lu." },
            },
        },
    },
    {
        name: 'resumerEmailsNonLus',
        description: "Récupère les derniers e-mails non lus (5 par défaut) et génère un résumé concis de leur contenu pour une lecture vocale.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nombre: { 
                    type: Type.NUMBER, 
                    description: "Optionnel. Le nombre d'e-mails à résumer. La valeur par défaut est 5." 
                },
            },
        },
    },
    {
        name: 'envoyerEmail',
        description: "Prépare un brouillon d'e-mail pour que l'utilisateur le vérifie avant de l'envoyer. Tu peux utiliser le nom d'un contact (ex: 'John Doe') et le système le résoudra en adresse e-mail.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                destinataire: { type: Type.STRING, description: "L'adresse e-mail ou le nom du contact destinataire." },
                sujet: { type: Type.STRING, description: "Le sujet de l'e-mail." },
                corps: { type: Type.STRING, description: "Le contenu de l'e-mail." },
// FIX: Add optional 'cc' and 'bcc' parameters to the AI function declaration.
                cc: { type: Type.STRING, description: "Optionnel. Destinataires en copie carbone (CC), séparés par des virgules." },
                bcc: { type: Type.STRING, description: "Optionnel. Destinataires en copie carbone invisible (BCC), séparés par des virgules." },
            },
            required: ['destinataire', 'sujet', 'corps'],
        },
    },
    {
        name: 'ajouterContenuEmailAuxNotes',
        description: "Crée une nouvelle note dans l'organiseur avec le contenu d'un e-mail spécifique.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                identifiantEmail: { type: Type.STRING, description: "Un identifiant pour trouver l'e-mail, comme sa position ('premier'), son expéditeur ('celui de Jane'), ou son sujet ('celui sur le rapport')." },
            },
            required: ['identifiantEmail'],
        },
    },
];

export const baseFunctionDeclarations: FunctionDeclaration[] = [
    {
        name: 'getWeatherForLocation',
        description: "Obtient la météo actuelle pour un lieu donné. Si aucun lieu n'est spécifié, utilise la localisation par défaut de l'utilisateur.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                location: {
                    type: Type.STRING,
                    description: "Optionnel. La ville pour laquelle obtenir la météo (ex: 'Paris', 'Londres')."
                },
            },
        },
    },
    {
        name: 'annulerDerniereAction',
        description: "Annule la toute dernière modification apportée aux listes (ajout, suppression, modification, etc.).",
        parameters: { type: Type.OBJECT, properties: {} },
    },
    ...calendarTools,
    ...gmailTools,
    {
        name: 'ajouterEtLierElementAProjet',
        description: "Ajoute un NOUVEL élément et l'associe IMMÉDIATEMENT à un projet existant. À n'utiliser que si l'utilisateur a confirmé vouloir lier l'élément.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomProjet: { type: Type.STRING, description: "Le nom du projet auquel lier l'élément." },
                typeElement: { type: Type.STRING, enum: ['tache', 'course', 'note', 'elementPersonnalise'], description: "Le type d'élément à créer." },
                contenu: { type: Type.STRING, description: "Le texte ou le nom principal de l'élément. Pour les notes, utilise du HTML pour le formatage (en remplissant les cellules <td> des tableaux)." },
                priorite: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: "Optionnel. La priorité si l'élément est une tâche." },
                nomListePersonnalisee: { type: Type.STRING, description: "Optionnel. Le nom de la liste personnalisée si c'est un élément personnalisé." },
            },
            required: ['nomProjet', 'typeElement', 'contenu'],
        },
    },
    {
        name: 'confirmerAjoutElementDuplique',
        description: "Si l'utilisateur confirme vouloir ajouter un élément malgré un doublon détecté, utilise cette fonction pour forcer l'ajout. N'utilise cette fonction qu'après avoir posé la question sur le doublon.",
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'annulerAjoutElementDuplique',
        description: "Si l'utilisateur annule l'ajout d'un élément après une détection de doublon, utilise cette fonction. N'utilise cette fonction qu'après avoir posé la question sur le doublon.",
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'surlignerTexteDansNote',
        description: "Surligne un ou plusieurs extraits de texte spécifiques dans une note existante en utilisant la balise HTML <mark>. Le texte doit correspondre exactement.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                noteIdentifier: { type: Type.STRING, description: "Une partie du contenu de la note pour l'identifier de manière unique." },
                textesASurligner: { 
                    type: Type.ARRAY, 
                    description: "Une liste des extraits de texte exacts à surligner.",
                    items: { type: Type.STRING }
                },
            },
            required: ['noteIdentifier', 'textesASurligner'],
        },
    },
    {
        name: 'creerProjet',
        description: "Crée un nouveau projet pour regrouper des éléments.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                titre: { type: Type.STRING, description: "Le nom du nouveau projet." },
                description: { type: Type.STRING, description: "Une brève description optionnelle du projet." },
            },
            required: ['titre'],
        },
    },
    {
        name: 'supprimerProjet',
        description: "Supprime un projet existant.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomProjet: { type: Type.STRING, description: "Le nom du projet à supprimer." },
            },
            required: ['nomProjet'],
        },
    },
    {
        name: 'afficherDetailsProjet',
        description: "Navigue vers la vue détaillée d'un projet spécifique.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomProjet: { type: Type.STRING, description: "Le nom du projet à afficher." },
            },
            required: ['nomProjet'],
        },
    },
    {
        name: 'lierElementAProjet',
        description: "Associe un élément (tâche, note, article) à un projet. Si le projet n'est pas spécifié, utilise le projet actuellement consulté.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomElement: { type: Type.STRING, description: "Le nom ou contenu de l'élément à lier." },
                nomProjet: { type: Type.STRING, description: "Optionnel. Le nom du projet cible." },
            },
            required: ['nomElement'],
        },
    },
    {
        name: 'delierElementDeProjet',
        description: "Dissocie un élément de son projet.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomElement: { type: Type.STRING, description: "Le nom ou contenu de l'élément à délier." },
            },
            required: ['nomElement'],
        },
    },
    {
        name: 'filtrerListe',
        description: "Filtre une liste pour n'afficher que les éléments correspondant à un critère donné.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomListe: { type: Type.STRING, description: "Le nom de la liste à filtrer (ex: 'tâches', 'courses', ou le nom d'une liste personnalisée)." },
                critereFiltre: { type: Type.STRING, description: "Le critère de filtrage en langage naturel (ex: 'priorité élevée', 'contenant le mot \"lait\"', 'les produits frais')." },
            },
            required: ['nomListe', 'critereFiltre'],
        },
    },
    {
        name: 'annulerFiltre',
        description: "Annule tout filtre actif et affiche à nouveau tous les éléments de toutes les listes.",
        parameters: { type: Type.OBJECT, properties: {} },
    },
    {
        name: 'supprimerElementsCoches',
        description: "Supprime tous les éléments cochés (complétés/achevés) d'une liste spécifiée.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomListe: {
                    type: Type.STRING,
                    description: "Le nom de la liste à nettoyer (ex: 'tâches', 'courses', ou le nom d'une liste personnalisée)."
                },
            },
            required: ['nomListe'],
        },
    },
    {
        name: 'definirDateLimiteTache',
        description: "Définit ou modifie la date limite d'une tâche.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskName: { type: Type.STRING, description: "Le nom approximatif de la tâche à modifier." },
                dueDate: { type: Type.STRING, description: "La date limite au format AAAA-MM-JJ." },
            },
            required: ['taskName', 'dueDate'],
        },
    },
    {
        name: 'trierTaches',
        description: "Trie la liste des tâches selon un critère.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                critere: { type: Type.STRING, enum: ['priorité', 'date', 'alphabétique'], description: "Le critère de tri." },
            },
            required: ['critere'],
        },
    },
    {
        name: 'afficherDetailsTache',
        description: "Affiche les détails d'une tâche spécifique, y compris sa description et ses sous-tâches.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskName: { type: Type.STRING, description: 'Le nom de la tâche dont il faut afficher les détails.' },
            },
            required: ['taskName'],
        },
    },
    {
        name: 'afficherDetailsNote',
        description: "Affiche le contenu complet d'une note.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                contentQuery: { type: Type.STRING, description: "Une partie du contenu de la note à afficher pour l'identifier." },
            },
            required: ['contentQuery'],
        },
    },
    {
        name: 'afficherDetailsArticleCourse',
        description: "Affiche les détails d'un article de la liste de courses.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                itemName: { type: Type.STRING, description: "Le nom de l'article dont il faut afficher les détails." },
            },
            required: ['itemName'],
        },
    },
    {
        name: 'afficherDetailsElementListePersonnalisee',
        description: "Affiche les détails d'un élément dans une liste personnalisée.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomListe: { type: Type.STRING, description: "Le nom de la liste contenant l'élément." },
                elementName: { type: Type.STRING, description: "Le nom de l'élément dont il faut afficher les détails." },
            },
            required: ['nomListe', 'elementName'],
        },
    },
    {
        name: 'ajouterDetailsArticleCourse',
        description: "Ajoute ou modifie des détails pour un article de la liste de courses.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                itemName: { type: Type.STRING, description: "Le nom de l'article à modifier." },
                quantity: { type: Type.NUMBER, description: "La quantité de l'article." },
                unit: { type: Type.STRING, enum: ['unit', 'kg', 'L'], description: "L'unité de mesure (nombre, kg, litre)." },
                store: { type: Type.STRING, description: "Le magasin où acheter l'article." },
                description: { type: Type.STRING, description: "Une description ou une note supplémentaire pour l'article." },
            },
            required: ['itemName'],
        },
    },
    {
        name: 'ajouterDescriptionTache',
        description: "Ajoute ou modifie la description longue d'une tâche existante.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskName: { type: Type.STRING, description: 'Le nom de la tâche à laquelle ajouter une description.' },
                description: { type: Type.STRING, description: 'Le contenu de la description.' },
            },
            required: ['taskName', 'description'],
        },
    },
    {
        name: 'ajouterDescriptionElementListePersonnalisee',
        description: "Ajoute ou modifie la description d'un élément dans une liste personnalisée.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomListe: { type: Type.STRING, description: "Le nom de la liste contenant l'élément." },
                elementName: { type: Type.STRING, description: "Le nom de l'élément à modifier." },
                description: { type: Type.STRING, description: "La description à ajouter ou modifier." },
            },
            required: ['nomListe', 'elementName', 'description'],
        },
    },
    {
        name: 'ajouterSousTache',
        description: "Ajoute une sous-tâche à une tâche principale existante.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskName: { type: Type.STRING, description: 'Le nom de la tâche principale.' },
                subtaskText: { type: Type.STRING, description: 'Le texte de la sous-tâche à ajouter.' },
            },
            required: ['taskName', 'subtaskText'],
        },
    },
    {
        name: 'basculerEtatSousTache',
        description: "Marque une sous-tâche comme terminée ou non terminée.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskName: { type: Type.STRING, description: 'Le nom de la tâche principale contenant la sous-tâche.' },
                subtaskName: { type: Type.STRING, description: 'Le nom de la sous-tâche à basculer.' },
            },
            required: ['taskName', 'subtaskName'],
        },
    },
    {
        name: 'ajouterTache',
        description: 'Ajoute une nouvelle tâche à la liste de choses à faire.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                task: { type: Type.STRING, description: 'Le contenu de la tâche à faire.' },
                priority: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: 'La priorité de la tâche. Par défaut "medium" si non spécifiée.' },
            },
            required: ['task'],
        },
    },
    {
        name: 'ajouterArticleCourse',
        description: 'Ajoute un nouvel article à la liste de courses.',
        parameters: {
            type: Type.OBJECT,
            properties: { item: { type: Type.STRING, description: "L'article à acheter." } },
            required: ['item'],
        },
    },
    {
        name: 'ajouterNote',
        description: 'Ajoute une nouvelle note.',
        parameters: {
            type: Type.OBJECT,
            properties: { content: { type: Type.STRING, description: 'Le contenu de la note. Utilise le HTML pour le formatage. Si tu crées un tableau, remplis les cellules <td> avec du texte.' } },
            required: ['content'],
        },
    },
    {
        name: 'basculerEtatTache',
        description: "Marque une tâche comme terminée ou non terminée en utilisant son nom.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskName: { type: Type.STRING, description: 'Le nom de la tâche à basculer. Doit correspondre approximativement à une tâche dans la liste.' },
            },
            required: ['taskName'],
        },
    },
     {
        name: 'basculerEtatArticleCourse',
        description: "Marque un article de la liste de courses comme acheté ou non acheté en utilisant son nom.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                itemName: { type: Type.STRING, description: 'Le nom de l\'article à basculer. Doit correspondre approximativement à un article dans la liste de courses.' },
            },
            required: ['itemName'],
        },
    },
    {
        name: 'supprimerTache',
        description: "Supprime une tâche de la liste de choses à faire en utilisant son nom.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskName: { type: Type.STRING, description: 'Le nom approximatif de la tâche à supprimer.' },
            },
            required: ['taskName'],
        },
    },
    {
        name: 'supprimerArticleCourse',
        description: "Supprime un article de la liste de courses en utilisant son nom.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                itemName: { type: Type.STRING, description: "Le nom approximatif de l'article à supprimer." },
            },
            required: ['itemName'],
        },
    },
    {
        name: 'supprimerNote',
        description: "Supprime une note en utilisant une partie de son contenu pour l'identifier.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                contentQuery: { type: Type.STRING, description: 'Une partie du contenu de la note à supprimer.' },
            },
            required: ['contentQuery'],
        },
    },
    {
        name: 'modifierNote',
        description: "Modifie le contenu d'une note existante.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                noteIdentifier: { type: Type.STRING, description: "L'identifiant de la note à modifier, en utilisant les premiers mots de la note tels que fournis dans le contexte (ex: 'Note (identifiant: \"Project meeting is...\")')." },
                nouveauContenu: { type: Type.STRING, description: "Le nouveau contenu HTML complet et mis à jour de la note. Assure-toi que les tableaux contiennent du texte dans leurs cellules <td>." },
            },
            required: ['noteIdentifier', 'nouveauContenu'],
        },
    },
    {
        name: 'modifierTache',
        description: "Modifie le texte d'une tâche existante.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                oldTaskName: { type: Type.STRING, description: 'Le nom approximatif de la tâche actuelle à modifier.' },
                newTaskName: { type: Type.STRING, description: 'Le nouveau texte de la tâche.' },
            },
            required: ['oldTaskName', 'newTaskName'],
        },
    },
    {
        name: 'modifierPrioriteTache',
        description: "Modifie la priorité d'une tâche existante.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                taskName: { type: Type.STRING, description: 'Le nom approximatif de la tâche à modifier.' },
                newPriority: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: 'La nouvelle priorité de la tâche.' },
            },
            required: ['taskName', 'newPriority'],
        },
    },
    {
        name: 'modifierArticleCourse',
        description: "Modifie le nom d'un article existant dans la liste de courses.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                oldItemName: { type: Type.STRING, description: "Le nom approximatif de l'article actuel à modifier." },
                newItemName: { type: Type.STRING, description: "Le nouveau nom de l'article." },
            },
            required: ['oldItemName', 'newItemName'],
        },
    },
    {
        name: 'deplacerElement',
        description: "Déplace un élément d'une liste à une autre.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                elementName: { type: Type.STRING, description: "Le nom de l'élément à déplacer." },
                sourceListName: { type: Type.STRING, description: "Le nom de la liste d'origine (ex: 'tâches', 'courses', ou le nom d'une liste personnalisée)." },
                destListName: { type: Type.STRING, description: "Le nom de la liste de destination." },
            },
            required: ['elementName', 'sourceListName', 'destListName'],
        },
    },
    {
        name: 'creerListePersonnalisee',
        description: 'Crée une nouvelle liste personnalisée.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                titre: { type: Type.STRING, description: 'Le nom de la nouvelle liste à créer.' },
            },
            required: ['titre'],
        },
    },
    {
        name: 'ajouterElementListePersonnalisee',
        description: 'Ajoute un élément à une des listes personnalisées de l\'utilisateur.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomListe: { type: Type.STRING, description: "Le nom de la liste où ajouter l'élément. Utilise le nom, y compris celui d'une liste que tu viens de créer dans cette conversation." },
                element: { type: Type.STRING, description: 'Le contenu de l\'élément à ajouter.' }
            },
            required: ['nomListe', 'element'],
        },
    },
     {
        name: 'basculerEtatElementListePersonnalisee',
        description: "Marque un élément d'une liste personnalisée comme complété ou non complété.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomListe: { type: Type.STRING, description: "Le nom de la liste contenant l'élément. Utilise le nom, y compris celui d'une liste que tu viens de créer dans cette conversation." },
                elementName: { type: Type.STRING, description: 'Le nom de l\'élément à basculer.' },
            },
            required: ['nomListe', 'elementName'],
        },
    },
    {
        name: 'supprimerElementListePersonnalisee',
        description: "Supprime un élément d'une liste personnalisée.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomListe: { type: Type.STRING, description: "Le nom de la liste contenant l'élément." },
                elementName: { type: Type.STRING, description: "Le nom approximatif de l'élément à supprimer." },
            },
            required: ['nomListe', 'elementName'],
        },
    },
    {
        name: 'modifierElementListePersonnalisee',
        description: "Modifie le texte d'un élément dans une liste personnalisée.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                nomListe: { type: Type.STRING, description: "Le nom de la liste contenant l'élément." },
                oldElementName: { type: Type.STRING, description: "Le nom approximatif de l'élément actuel à modifier." },
                newElementName: { type: Type.STRING, description: "Le nouveau texte de l'élément." },
            },
            required: ['nomListe', 'oldElementName', 'newElementName'],
        },
    },
];