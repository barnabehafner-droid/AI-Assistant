import { Type, FunctionDeclaration } from "@google/genai";
import { OrganizedData, CustomList, TodoItem, ShoppingItem, NoteItem, CalendarEvent, FullEmail, WeatherData, InfoCard, EnrichmentMetadata, Project, VoiceSettings, GoogleDriveFile } from '../types';
import { ai } from './aiClient';
import * as googleMailService from './googleMailService';
import { buildSystemInstruction } from './aiConfig';


// NEW type for chat history
export type ChatMessage = {
    role: "user" | "model";
    parts: { text: string }[];
};


const cleanUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    try {
        const urlObj = new URL(url);
        // Check for Google redirection links (e.g., from web search grounding)
        if (urlObj.hostname.includes('google.com') && urlObj.pathname === '/url') {
            const targetUrl = urlObj.searchParams.get('q');
            if (targetUrl) {
                return targetUrl;
            }
        }
    } catch (e) {
        // If it fails to parse as a URL, return original string
        return url;
    }
    // If no redirection pattern matched, return the original URL.
    return url;
};


const baseProperties = {
  todos: {
    type: Type.ARRAY,
    description: 'List of to-do items.',
    items: {
      type: Type.OBJECT,
      properties: {
        task: {
          type: Type.STRING,
          description: 'The specific task to be done.',
        },
        completed: {
          type: Type.BOOLEAN,
          description: 'Always set to false for new items.',
        },
        priority: {
          type: Type.STRING,
          enum: ['high', 'medium', 'low'],
          description: "Priority based on urgency. Use 'high' for time-sensitive tasks (e.g., 'by tomorrow', 'ASAP'). Use 'medium' for standard tasks. Use 'low' for tasks with no urgency.",
        },
        dueDate: {
          type: Type.STRING,
          description: "The due date for the task in YYYY-MM-DD format. Infer from the text (e.g., 'tomorrow', 'next Friday', 'August 25'). If no date is mentioned, omit this field.",
        },
      },
      required: ['task', 'completed', 'priority'],
    },
  },
  shopping: {
    type: Type.ARRAY,
    description: 'List of items to buy.',
    items: {
      type: Type.OBJECT,
      properties: {
        item: {
          type: Type.STRING,
          description: 'The specific item to purchase.',
        },
        completed: {
          type: Type.BOOLEAN,
          description: 'Always set to false for new items.',
        },
        category: {
            type: Type.STRING,
            description: 'The general category of the item (e.g., "Alimentaire", "Entretien", "Bricolage", "Pharmacie").'
        },
        aisle: {
            type: Type.STRING,
            description: 'The specific store aisle for the item (e.g., "Fruits & Légumes", "Produits laitiers", "Boulangerie", "Surgelés").'
        }
      },
      required: ['item', 'completed'],
    },
  },
  notes: {
    type: Type.ARRAY,
    description: 'List of general notes or reminders.',
    items: {
      type: Type.OBJECT,
      properties: {
        content: {
          type: Type.STRING,
          description: "The content of the note. Use HTML tags (e.g., <b>, <ul>, <li>, <table>) for formatting. When creating tables, ensure all <td> cells are filled with the appropriate content.",
        },
      },
      required: ['content'],
    },
  },
  events: {
    type: Type.ARRAY,
    description: "List of calendar events identified in the user's input. Infer full ISO 8601 date-time strings for start and end, including timezone information.",
    items: {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING, description: "The title of the event." },
            location: { type: Type.STRING, description: "The location or address of the event." },
            start: {
                type: Type.OBJECT,
                properties: {
                    dateTime: { type: Type.STRING, description: "The start date and time in ISO 8601 format (e.g., YYYY-MM-DDTHH:MM:SSZ)." }
                },
                required: ['dateTime']
            },
            end: {
                type: Type.OBJECT,
                properties: {
                    dateTime: { type: Type.STRING, description: "The end date and time in ISO 8601 format (e.g., YYYY-MM-DDTHH:MM:SSZ)." }
                },
                 required: ['dateTime']
            },
        },
        required: ['summary', 'start', 'end']
    }
  },
};

// Helper to sanitize list titles into valid JSON keys
export const sanitizeTitleForKey = (title: string) => {
    return title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

const buildGenerationConfig = (customLists: CustomList[] = []) => {
    const customListProperties: Record<string, any> = {};
    const customListInstructions: string[] = [];

    customLists.forEach(list => {
      const propertyKey = sanitizeTitleForKey(list.title);
      
      const itemProperties: Record<string, any> = {
        item: {
            type: Type.STRING,
            description: `The main name or text for an item in the '${list.title}' list.`
        },
        completed: {
            type: Type.BOOLEAN,
            description: 'Always set to false for new items.'
        }
      };

      let fieldNames: string[] = [];
      list.fields.forEach(field => {
        const fieldKey = sanitizeTitleForKey(field.name);
        itemProperties[fieldKey] = {
            type: Type.STRING,
            description: `The value for the '${field.name}' field.`
        };
        fieldNames.push(`'${field.name}' (key: ${fieldKey})`);
      });

      customListProperties[propertyKey] = {
        type: Type.ARRAY,
        description: `List of items for the custom list: '${list.title}'.`,
        items: {
          type: Type.OBJECT,
          properties: itemProperties,
          required: ['item', 'completed'],
        },
      };

      let instruction = `'${list.title}' (use property key '${propertyKey}')`;
      if (fieldNames.length > 0) {
        instruction += ` with custom fields: ${fieldNames.join(', ')}`;
      }
      customListInstructions.push(instruction);
    });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        ...baseProperties,
        ...customListProperties,
      },
    };
    
    let systemInstruction = "You are an intelligent personal assistant. Your task is to analyze the user's input text (provided in the prompt) and categorize it into 'todos', 'shopping', 'notes', and 'events'. For 'todos', infer a priority ('high', 'medium', 'low') and a 'dueDate' (in YYYY-MM-DD format if mentioned). For 'shopping' items, also infer a 'category' and an 'aisle'. Examples of categories: \"Alimentaire\", \"Bricolage\", \"Pharmacie\", \"Entretien\". Examples of aisles: \"Fruits & Légumes\", \"Boulangerie\", \"Surgelés\", \"Produits laitiers\". For 'notes', format the content using HTML tags (<b>, <i>, <ul>, <li>, <table>, etc.) to represent lists, tables, and text formatting. When creating tables, ensure that all <td> cells are filled with the relevant text. For 'events', infer the title, location, and the full start and end date-times in ISO 8601 format. For all items, generate output strictly following the JSON schema. Do not add extra text.";
    
    if (customLists.length > 0) {
        systemInstruction += ` You can also categorize items into custom lists. When adding to a custom list, fill in its specific fields if the user provides relevant information. Available custom lists: ${customListInstructions.join('; ')}.`;
    }

    return {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
    };
};

const parseAndStructureResponse = (jsonText: string, customLists: CustomList[]): OrganizedData => {
    const parsedData: any = JSON.parse(jsonText);
    
    const result: OrganizedData = {
        todos: parsedData.todos || [],
        shopping: parsedData.shopping || [],
        notes: parsedData.notes || [],
        events: parsedData.events || [],
    };
    
    customLists.forEach(list => {
        const propertyKey = sanitizeTitleForKey(list.title);
        if (parsedData[propertyKey]) {
            result[propertyKey] = (parsedData[propertyKey] as any[]).map(rawItem => {
                const { item, completed, ...rest } = rawItem;
                const customFields: Record<string, string> = {};
                
                list.fields.forEach(field => {
                    const fieldKey = sanitizeTitleForKey(field.name);
                    if (rest[fieldKey]) {
                        customFields[field.id] = rest[fieldKey];
                    }
                });
                
                return { item, completed, customFields };
            });
        }
    });

    return result;
};


export const organizeInput = async (userInput: string, customLists: CustomList[] = []): Promise<OrganizedData> => {
  try {
    const config = buildGenerationConfig(customLists);
    // FIX: Send only the user's raw input as the main content.
    // The instructions have been moved to the system prompt in buildGenerationConfig
    // to prevent character encoding issues with special characters.
    const contents = userInput;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config,
    });
    const jsonText = response.text;
    return parseAndStructureResponse(jsonText, customLists);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to organize input. Please check your input or API key.");
  }
};

export async function* streamChat(history: ChatMessage[], context: string, userMessage: string, voiceSettings: VoiceSettings): AsyncGenerator<string> {
    const baseInstruction = `You are a helpful and friendly AI assistant for a personal organizer app. Your goal is to answer questions and help the user understand their data based on the context provided.
- Be conversational and concise.
- Use the provided context (lists, calendar, contacts, search results, etc.) to give accurate answers.
- If the user asks you to perform an action (like adding a task, sending an email, etc.), politely decline and explain that you can only provide information and answer questions in this text chat. Suggest they use the main input bar or the voice assistant for actions.
- If the context includes search results, base your answer primarily on those results.

Here is the user's current data context:\n\n${context}`;
    
    const systemInstruction = buildSystemInstruction(voiceSettings, baseInstruction);

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction,
        },
        history,
    });

    const responseStream = await chat.sendMessageStream({ message: userMessage });

    for await (const chunk of responseStream) {
        yield chunk.text;
    }
}

export const fetchWeatherData = async (location: string): Promise<WeatherData> => {
  try {
    const contents = `Get the current weather for ${location}. Respond ONLY with a JSON object containing "temperature" (number, in Celsius), "condition" (string, in French), and "location" (string). Example: {"temperature": 22, "condition": "Ensoleillé", "location": "Paris"}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let jsonText = response.text;
    const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
        jsonText = jsonMatch[1];
    }
    
    const weatherData = JSON.parse(jsonText);
    
    if (weatherData && typeof weatherData.temperature === 'number' && typeof weatherData.condition === 'string' && typeof weatherData.location === 'string') {
      return weatherData;
    }
    throw new Error("Invalid weather data format received from AI.");

  } catch (error) {
    console.error("Error fetching weather data via Gemini:", error);
    throw new Error(`Failed to get weather for ${location}.`);
  }
};

export const enrichTask = async (task: { id: string; taskText: string; enrichmentQuery: string }): Promise<{ taskId: string; enrichedData: InfoCard[]; enrichmentMetadata: EnrichmentMetadata; }> => {
    
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, enum: ['PHONE', 'ADDRESS', 'WEBSITE', 'HOURS', 'RECIPE_INGREDIENTS', 'RECIPE_STEPS', 'GENERIC_TEXT'] },
                label: { type: Type.STRING },
                content: { type: Type.STRING }
            },
            required: ['type', 'label', 'content']
        }
    };

    const processJsonToInfoCards = (jsonData: any[]): InfoCard[] => {
        return jsonData.map((card: {type: InfoCard['type'], label: string, content: string}) => {
            if (card.type === 'WEBSITE') {
                return { ...card, content: cleanUrl(card.content) };
            }
            if (card.type === 'RECIPE_INGREDIENTS' || card.type === 'RECIPE_STEPS' || card.type === 'HOURS') {
                return { ...card, content: card.content.split('\n').filter((s: string) => s.trim() !== '') };
            }
            return card;
        });
    };

    // Attempt Web Search with strict JSON output. No fallback to internal knowledge.
    try {
        const systemInstruction = `You are an information enrichment expert. Your task is to find relevant information for a user's query using Google Search and structure the output into structured information cards.
**CRITICAL RULES:**
1.  Your response MUST be ONLY a single, valid JSON array of objects that strictly follows the provided schema. Do not include any other text, markdown formatting, or explanations.
2.  Break down information into separate, specific cards for each piece of data (phone, address, website, etc.). Use 'GENERIC_TEXT' ONLY as a last resort for descriptive text.
3.  For 'RECIPE_INGREDIENTS', 'RECIPE_STEPS', and 'HOURS', the 'content' field must be a single string with each item separated by a newline character (\\n).
4.  DO NOT combine different data types in one card. For example, an address and a phone number must be in two separate cards.
5.  If no structured information (like phone, address, recipe, etc.) is found, return an empty array [].
6.  All text, especially the 'label' and 'content' fields, MUST be in French. For example, use "Téléphone" for a phone number label, "Site Web" for a website, "Adresse" for an address, etc.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `For the query "${task.enrichmentQuery}", find relevant information and structure the output as a JSON array of info cards.`,
            config: { 
                systemInstruction, 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema,
            },
        });
        
        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);
        const processedData = processJsonToInfoCards(parsedData);
        
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c.web).filter((w: any) => w && w.uri).map((w: any) => ({ ...w, uri: cleanUrl(w.uri) })) || [];
        const enrichmentMetadata: EnrichmentMetadata = { query: task.enrichmentQuery, sources };

        return { taskId: task.id, enrichedData: processedData, enrichmentMetadata };

    } catch (error) {
        console.error("Web search enrichment failed:", error);
        throw new Error("Failed to enrich task.");
    }
};

export const getCityFromCoordinates = async (latitude: number, longitude: number): Promise<string> => {
  try {
    const contents = `Based on the following GPS coordinates, what is the city and country? Latitude: ${latitude}, Longitude: ${longitude}. Respond ONLY with a JSON object containing "city" and "country". Example: {"city": "Paris", "country": "France"}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let jsonText = response.text;
    const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const locationData = JSON.parse(jsonText);

    if (locationData && typeof locationData.city === 'string') {
      return locationData.country ? `${locationData.city}, ${locationData.country}` : locationData.city;
    }
    throw new Error("Invalid location data format received from AI.");
  } catch (error) {
    console.error("Error reverse geocoding via Gemini:", error);
    throw new Error(`Failed to get city for coordinates.`);
  }
};


export const analyzeImageAndSuggestAction = async (base64ImageDatas: string[], customLists: CustomList[] = []) => {
  try {
    const imageParts = base64ImageDatas.map(data => ({
        inlineData: {
            mimeType: 'image/jpeg',
            data: data,
        },
    }));

    const systemInstruction = `You are a multimodal assistant analyzing images for an organizer app. Your primary goal is to identify the main intent behind the text in the image and extract relevant, structured data.

Your process is:
1.  Analyze the text in the image(s).
2.  Classify the content into ONE of the following intents: 'ORGANIZE_LISTS', 'CHECK_SHOPPING_LIST', 'CREATE_CONTACT', 'CREATE_EVENT', 'CREATE_EMAIL'. If none fit, use 'ORGANIZE_LISTS' as a fallback for general text.
3.  Based on the intent, extract the data and populate ONLY the corresponding field in the JSON output.
4.  Your response MUST be a single, valid JSON object that strictly follows the provided schema. Do not add any extra text or explanations.

Intent-specific instructions:
- **ORGANIZE_LISTS**: Use for general lists (to-dos, shopping, notes) or any text that doesn't fit other categories. Extract items into their respective categories. For 'notes', use HTML for formatting.
- **CHECK_SHOPPING_LIST**: Use specifically for shopping receipts or lists of purchased items. Extract only the names of the items.
- **CREATE_CONTACT**: Use for business cards or contact information. Extract name, email, and phone number.
- **CREATE_EVENT**: Use for invitations or event announcements. Extract summary, start/end times (in ISO 8601 format), location, and description.
- **CREATE_EMAIL**: Use for blocks of text that look like email content. Extract the body, and if possible, a recipient and subject.
`;
    
    const customListProperties: Record<string, any> = {};
    customLists.forEach(list => {
      const propertyKey = sanitizeTitleForKey(list.title);
      customListProperties[propertyKey] = {
        type: Type.ARRAY,
        description: `Items for the '${list.title}' list.`,
        items: {
          type: Type.OBJECT,
          properties: {
            item: { type: Type.STRING },
            completed: { type: Type.BOOLEAN, description: 'Always false.' }
          },
          required: ['item', 'completed']
        }
      };
    });

    const organizedDataSchema = {
      type: Type.OBJECT,
      properties: { ...baseProperties, ...customListProperties },
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            intent: {
                type: Type.STRING,
                enum: ['ORGANIZE_LISTS', 'CHECK_SHOPPING_LIST', 'CREATE_CONTACT', 'CREATE_EVENT', 'CREATE_EMAIL'],
            },
            organizedData: organizedDataSchema,
            shoppingItems: { type: Type.ARRAY, description: "List of item names from a receipt.", items: { type: Type.STRING } },
            contact: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, email: { type: Type.STRING }, phone: { type: Type.STRING } } },
            event: { type: Type.OBJECT, properties: { summary: { type: Type.STRING }, start: { type: Type.OBJECT, properties: { dateTime: { type: Type.STRING } }, required: ['dateTime'] }, end: { type: Type.OBJECT, properties: { dateTime: { type: Type.STRING } }, required: ['dateTime'] }, location: { type: Type.STRING }, description: { type: Type.STRING } }, required: ['summary', 'start', 'end'] },
            email: { type: Type.OBJECT, properties: { recipient: { type: Type.STRING }, subject: { type: Type.STRING }, body: { type: Type.STRING } }, required: ['body'] },
        },
        required: ['intent']
    };

    const textPart = { text: "Analyze the text in this/these image(s) and determine the user's primary intent, returning a structured JSON response." };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [...imageParts, textPart] },
        config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
        },
    });
    
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);

    if (result.intent === 'ORGANIZE_LISTS' && result.organizedData) {
        result.organizedData = parseAndStructureResponse(JSON.stringify(result.organizedData), customLists);
    }
    
    return result;
  } catch (error) {
    console.error("Error calling Gemini API for image analysis:", error);
    throw new Error("Failed to analyze photo. The AI could not process the image or an error occurred.");
  }
};

export const generatePlanFromConversation = async (conversationHistory: string): Promise<{ title: string; description: string; plan: OrganizedData }> => {
    try {
        const systemInstruction = `You are a project management expert. Based on the following conversation between a user and an AI assistant, your task is to create a comprehensive project plan.
Your response MUST be a JSON object that strictly follows the provided schema, containing a 'title', a 'description', and a 'plan' object.
- The 'title' should be a concise name for the project.
- The 'description' should be a brief, one or two-sentence summary.
- The 'plan' object must contain three arrays: 'todos', 'shopping', and 'notes'.
- Analyze the user's goal and break it down into actionable steps, categorizing each one appropriately.
- 'todos': For specific actions to be completed (e.g., "Send invitations", "Book venue"). Infer priority and due dates where possible.
- 'shopping': For items that need to be purchased (e.g., "Birthday cake", "Decorations").
- 'notes': For information, lists, or reminders that are not actionable tasks (e.g., "Guest list: John, Jane, Mike", "Venue ideas: Park, Community Hall"). Use HTML tags for formatting (e.g., <ul><li>...</li></ul> for lists). When generating tables, ensure all <td> cells are filled with the appropriate content.
Respond ONLY with the JSON object. Do not add any extra text or explanations.`;
        
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                title: {
                    type: Type.STRING,
                    description: 'A concise title for the project.'
                },
                description: {
                    type: Type.STRING,
                    description: 'A brief, one or two-sentence description of the project.'
                },
                plan: {
                    type: Type.OBJECT,
                    properties: {
                        ...baseProperties,
                    },
                }
            },
            required: ['title', 'description', 'plan']
        };

        const contents = `Here is the conversation history:\n\n${conversationHistory}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
            },
        });
        // FIX: According to the new guidelines, response.text should be accessed directly.
        const jsonText = response.text;
        const parsedResult = JSON.parse(jsonText);

        const structuredPlan = {
            ...parsedResult,
            plan: {
                todos: parsedResult.plan?.todos || [],
                shopping: parsedResult.plan?.shopping || [],
                notes: parsedResult.plan?.notes || [],
            }
        };

        return structuredPlan;

    } catch (error) {
        console.error("Error calling Gemini API for project plan:", error);
        throw new Error("Failed to generate project plan.");
    }
};

export const draftNoteWithAI = async (noteContext: string, conversationHistory: { speaker: 'user' | 'ai'; text: string }[]): Promise<string> => {
    try {
        const systemInstruction = `Tu es un assistant de rédaction expert et proactif. Ta tâche est d'aider l'utilisateur à rédiger et éditer une note. Le contenu HTML actuel de la note est ci-dessous.
Analyse la note et l'historique de la conversation pour guider l'utilisateur. Au lieu d'attendre passivement, propose des améliorations (style, clarté), suggère des idées pour étendre ou préciser le sujet, et pose des questions pour clarifier l'intention de l'utilisateur.

- Si l'utilisateur demande une modification concrète (ex: "résume ça", "mets la première phrase en gras", "crée un tableau 3x2"), ta réponse doit être UNIQUEMENT le contenu HTML complet et mis à jour de la note, en utilisant des balises comme <b>, <i>, <ul>, <li>, <table>. Lors de la création ou de la modification de tableaux, assure-toi que le contenu textuel est correctement placé dans les cellules <td>.
- Si la conversation est plus générale, sois un partenaire de brainstorming. Propose des directions, des questions et des suggestions. Par exemple : "Ce début est prometteur. Pourrions-nous ajouter une statistique pour renforcer votre argument ?" ou "Le ton est informel, est-ce le style que vous recherchez ?".`;

        const historyText = conversationHistory.map(msg => `${msg.speaker.toUpperCase()}: ${msg.text}`).join('\n');

        const contents = `
CURRENT NOTE CONTENT (HTML):
---
${noteContext}
---

CONVERSATION HISTORY:
---
${historyText}
---
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
            },
        });
        // FIX: According to the new guidelines, response.text should be accessed directly.
        return response.text;

    } catch (error) {
        console.error("Error calling Gemini API for note drafting:", error);
        throw new Error("Failed to get response from AI assistant.");
    }
};

export const filterListWithAI = async (items: { id: string, text: string }[], criteria: string): Promise<string[]> => {
      try {
        const systemInstruction = "You are a data filtering expert. Analyze the provided list of items and the filter criteria. Your ONLY output must be a JSON array of strings, containing the 'id' of each item that matches the criteria. Do not return any other text, explanations, or formatting.";
        
        const responseSchema = {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        };

        const contents = `
          Filter Criteria: "${criteria}"

          Items List (JSON):
          ${JSON.stringify(items)}
        `;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
          },
        });
        // FIX: According to the new guidelines, response.text should be accessed directly.
        const jsonText = response.text;
        const matchingIds = JSON.parse(jsonText);
        
        if (Array.isArray(matchingIds) && matchingIds.every(id => typeof id === 'string')) {
            return matchingIds;
        }
        console.warn("AI filter did not return a valid array of strings:", matchingIds);
        return [];

      } catch (error) {
        console.error("Error calling Gemini API for filtering:", error);
        return [];
      }
    };
export const rewriteCustomInstruction = async (instruction: string): Promise<string> => {
    try {
        const systemInstruction = `You are an expert prompt engineer. The user has provided a custom instruction for their AI personal assistant. Your task is to rewrite this instruction to be clear, concise, and effective for a large language model. The instruction will be appended to the main system prompt of a voice assistant that helps manage to-do lists, shopping lists, notes, and projects. Ensure the rewritten instruction is a direct command or behavioral guideline for the AI. For example, if the user writes 'I want the AI to be funny', you could rewrite it to 'Always include a relevant, light-hearted joke in your responses.' If the user writes 'don't talk about my projects', you could rewrite it to 'You must never mention the user's projects unless they explicitly ask about them.' Your output must be ONLY the rewritten instruction as a single string, without any prefixes, quotes, or explanations.`;

        const contents = `User instruction to rewrite: "${instruction}"`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
            },
        });
        // FIX: According to the new guidelines, response.text should be accessed directly.
        return response.text;

    } catch (error) {
        console.error("Error calling Gemini API for instruction rewrite:", error);
        throw new Error("Failed to rewrite instruction. Please try again.");
    }
};

export const analyzeWritingStyle = async (accessToken: string): Promise<string> => {
    try {
        const emailBodies = await googleMailService.getSentEmails(accessToken, 5);
        if (emailBodies.length === 0) {
            throw new Error("Aucun e-mail envoyé trouvé pour analyser le style.");
        }

        const systemInstruction = `Tu es un analyste de style d'écriture. Analyse les extraits d'e-mails suivants d'un utilisateur. Ta tâche est de produire un résumé concis, sous forme de liste à puces, de son style d'écriture. Concentre-toi sur le ton (formel/informel), les phrases courantes, la structure des phrases, l'utilisation de la ponctuation, des emojis et les salutations/formules de politesse typiques. La sortie doit être un texte descriptif court qu'une autre IA pourra utiliser comme guide pour imiter ce style. Ne produis rien d'autre.`;

        const contents = `Voici les e-mails à analyser :\n\n---DEBUT EMAIL 1---\n${emailBodies[0]}\n---FIN EMAIL 1---\n\n---DEBUT EMAIL 2---\n${emailBodies[1] || ''}\n---FIN EMAIL 2---\n\n---DEBUT EMAIL 3---\n${emailBodies[2] || ''}\n---FIN EMAIL 3---`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
            },
        });

        return response.text;

    } catch (error) {
        console.error("Error calling Gemini API for style analysis:", error);
        if (error instanceof Error && error.message.includes("Aucun e-mail")) {
            throw error;
        }
        throw new Error("Impossible d'analyser le style d'écriture. Veuillez réessayer.");
    }
};

export const extractItemsFromEmailForList = async (
  email: FullEmail, 
  listType: 'todos' | 'shopping' | 'custom', 
  customListContext?: CustomList
): Promise<any[]> => {
  try {
    let systemInstruction = `You are an intelligent personal assistant. Your task is to analyze an email and extract specific items to be added to a list. Respond ONLY with a valid JSON array of objects, matching the provided schema. If no items are found, return an empty array [].`;
    
    let responseSchema: any;
    
    // Use the HTML body for better contextual analysis by the AI
    const emailBodyText = email.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let content = `Email From: ${email.from}\nEmail Subject: ${email.subject}\nEmail Body:\n${emailBodyText}\n\n`;

    switch (listType) {
      case 'todos':
        systemInstruction += " Extract actionable to-do tasks from the email.";
        content += "Identify the tasks from this email.";
        responseSchema = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              task: { type: Type.STRING, description: 'The specific task to be done.' },
              priority: { type: Type.STRING, enum: ['high', 'medium', 'low'], description: "Infer priority based on urgency. Default to 'medium'." },
              dueDate: { type: Type.STRING, description: "Infer due date in YYYY-MM-DD format if available." },
            },
            required: ['task'],
          }
        };
        break;
      
      case 'shopping':
        systemInstruction += " Extract items to be purchased from the email.";
        content += "Identify the shopping items from this email.";
        responseSchema = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              item: { type: Type.STRING, description: 'The specific item to purchase.' },
            },
            required: ['item'],
          }
        };
        break;
        
      case 'custom':
        if (!customListContext) throw new Error("Custom list context is required for custom list extraction.");
        systemInstruction += `Extract items relevant to the custom list named "${customListContext.title}". Use the list's existing items and fields as context.`;
        content += `The target list is "${customListContext.title}". Its current items are: ${customListContext.items.map(i => i.text).join(', ') || 'none'}. Identify relevant items from the email to add to this list.`;
        
        const itemProperties: Record<string, any> = {
            item: { type: Type.STRING, description: `The main name for an item in the '${customListContext.title}' list.` },
        };
        customListContext.fields.forEach(field => {
            const fieldKey = sanitizeTitleForKey(field.name);
            itemProperties[fieldKey] = {
                type: Type.STRING,
                description: `The value for the '${field.name}' field, inferred from the email.`
            };
        });
        
        responseSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: itemProperties,
                required: ['item'],
            }
        };
        break;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: content,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const jsonText = response.text;
    const parsedResult = JSON.parse(jsonText);

    if (listType === 'custom' && customListContext) {
        return parsedResult.map((rawItem: any) => {
            const { item, ...rest } = rawItem;
            const customFields: Record<string, string> = {};
            customListContext.fields.forEach(field => {
                const fieldKey = sanitizeTitleForKey(field.name);
                if (rest[fieldKey]) {
                    customFields[field.id] = rest[fieldKey];
                }
            });
            return { item, customFields };
        });
    }

    return parsedResult;

  } catch (error) {
    console.error(`Error extracting items from email for ${listType}:`, error);
    throw new Error(`Failed to process email for ${listType} list.`);
  }
};

export const interpretChatQuery = async (query: string): Promise<{ gmailQuery?: string; driveQuery?: string; }> => {
    try {
        const systemInstruction = `You are a search query interpreter for a text-based AI assistant. Analyze the user's natural language query and determine if they are trying to search their Gmail or Google Drive.
- If the query is about emails, translate it into a structured Gmail search query using advanced operators (e.g., from:, subject:, has:attachment).
- If the query is about files, documents, presentations, etc., translate it into a keyword-based search query for Google Drive.
- If the query is NOT a search request for emails or files, both keys in the JSON response must be null.
- Respond ONLY with a JSON object. Do not add explanations.`;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                gmailQuery: {
                    type: Type.STRING,
                    description: "The structured search query for Gmail, or null if not applicable."
                },
                driveQuery: {
                    type: Type.STRING,
                    description: "Keywords for searching Google Drive, or null if not applicable."
                }
            },
        };

        const contents = `User query: "${query}"`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
            },
        });

        const jsonText = response.text;
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error calling Gemini API for chat query interpretation:", error);
        // Fallback to avoid breaking the chat
        return { };
    }
};

export const searchLocalDataWithAI = async (
    query: string,
    data: {
        todos: TodoItem[];
        shopping: ShoppingItem[];
        notes: NoteItem[];
        projects: Project[];
        customLists: CustomList[];
    }
): Promise<{
    todoIds?: string[];
    shoppingIds?: string[];
    noteIds?: string[];
    projectIds?: string[];
    customItemIds?: { listId: string; itemId: string }[];
}> => {
    try {
        const systemInstruction = `You are a powerful search assistant for a personal organizer app. Your task is to analyze a user's natural language query and find all matching items across different categories: todos, shopping items, notes, projects, and custom list items.
- Your response MUST be a single JSON object matching the provided schema, containing arrays of the IDs of all matching items.
- Match based on keywords, but also on semantic meaning. For example, 'urgent' could mean a todo with priority 'high'. A project name in the query should filter items linked to that project.
- If the query is "tâches urgentes pour le projet vacances", you should find todos with priority 'high' that have the projectId matching the 'vacances' project.
- Return empty arrays for categories with no matches. Do not add any other text or explanations.`;
        
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                todoIds: { type: Type.ARRAY, description: "IDs of matching to-do items.", items: { type: Type.STRING } },
                shoppingIds: { type: Type.ARRAY, description: "IDs of matching shopping items.", items: { type: Type.STRING } },
                noteIds: { type: Type.ARRAY, description: "IDs of matching notes.", items: { type: Type.STRING } },
                projectIds: { type: Type.ARRAY, description: "IDs of matching projects.", items: { type: Type.STRING } },
                customItemIds: {
                    type: Type.ARRAY,
                    description: "IDs of matching custom list items.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            listId: { type: Type.STRING, description: "The ID of the custom list." },
                            itemId: { type: Type.STRING, description: "The ID of the item within the list." }
                        },
                        required: ['listId', 'itemId']
                    }
                }
            },
        };

        const simplifiedData = {
            todos: data.todos.map(t => ({ id: t.id, task: t.task, priority: t.priority, description: t.description, projectId: t.projectId })),
            shopping: data.shopping.map(s => ({ id: s.id, item: s.item, description: s.description, projectId: s.projectId })),
            notes: data.notes.map(n => ({ id: n.id, content: n.content.replace(/<[^>]+>/g, ' '), projectId: n.projectId })),
            projects: data.projects.map(p => ({ id: p.id, title: p.title, description: p.description })),
            customLists: data.customLists.map(l => ({
                id: l.id,
                title: l.title,
                items: l.items.map(i => ({ id: i.id, text: i.text, projectId: i.projectId }))
            }))
        };
        
        const contents = `User Search Query: "${query}"\n\nData to search through (use the IDs from this data in your response):\n${JSON.stringify(simplifiedData)}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
            },
        });

        const jsonText = response.text;
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error calling Gemini API for local search:", error);
        return {}; // Return empty object on error
    }
};

export const searchFaq = async (
  query: string,
  faqData: { question: string }[]
): Promise<{ matchedIndex?: number; generatedAnswer?: string }> => {
  try {
    const systemInstruction = `You are a helpful FAQ assistant for a personal organizer application. Your task is to process a user's query against a list of frequently asked questions.

You have three modes of operation:
1.  **Match Question:** First, analyze the user's query and compare it to the questions in the provided FAQ list. If the user's query is semantically similar to one of the existing questions, your primary goal is to return the index of that question.
2.  **Generate Answer:** If, and ONLY IF, the user's query is NOT a good match for any existing questions BUT is clearly about how to use the application, you should generate a concise and helpful answer yourself.
3.  **Decline:** If the query is not related to the application's usage at all, you must politely decline to answer.

Your response MUST be a JSON object with ONE of the following keys:
- "matchedIndex": A number representing the 0-based index of the matching question from the FAQ list. Use this if you find a match.
- "generatedAnswer": A string containing your answer. Use this ONLY if there is no match AND the question is relevant to the app. For irrelevant questions, the string should be "Je suis désolé, je ne peux répondre qu'aux questions concernant l'utilisation de l'application."`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        matchedIndex: {
          type: Type.NUMBER,
          description: "The 0-based index of the best matching FAQ question.",
        },
        generatedAnswer: {
          type: Type.STRING,
          description: "A generated answer if no question matches but the query is relevant, or a polite refusal.",
        },
      },
    };

    const faqForPrompt = faqData.map((item, index) => `[${index}] ${item.question}`).join('\n');

    const contents = `
      User Query: "${query}"

      FAQ List:
      ---
      ${faqForPrompt}
      ---
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const jsonText = response.text;
    return JSON.parse(jsonText);

  } catch (error) {
    console.error("Error calling Gemini API for FAQ search:", error);
    return { generatedAnswer: "Désolé, une erreur est survenue lors de la recherche." };
  }
};

export const getShareSuggestion = async (sharedContent: { title?: string; text?: string; url?: string }): Promise<string> => {
    try {
        const systemInstruction = `You are a UX expert. A user has shared content to a personal organizer app. Based on the content, suggest a short, clear, and actionable button label. The action should be the most logical one for the content type.
- If it's a URL to an article, suggest adding it as a note.
- If it's just text, suggest adding it as a to-do or a note.
- If it's a product link, suggest adding to the shopping list.
Your response MUST be ONLY the button text, phrased as a question. For example: "Créer une note avec cet article ?", "Ajouter comme nouvelle tâche ?", "Ajouter à la liste de courses ?". Do not add any other text or quotes.`;

        let content = "User shared the following content:\n";
        if (sharedContent.title) content += `Title: ${sharedContent.title}\n`;
        if (sharedContent.url) content += `URL: ${sharedContent.url}\n`;
        if (sharedContent.text) content += `Text: ${sharedContent.text}\n`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: content,
            config: {
                systemInstruction,
            },
        });

        return response.text.trim() || "Ajouter comme note ?";
    } catch (error) {
        console.error("Error getting share suggestion:", error);
        return "Ajouter comme note ?"; // Fallback
    }
};

export const categorizeShoppingItems = async (
  items: { id: string; item: string }[]
): Promise<{ id: string; category: string; aisle: string }[]> => {
  if (items.length === 0) {
    return [];
  }
  try {
    const systemInstruction = `You are a shopping list organization expert. Your task is to assign a relevant 'category' and 'aisle' for each shopping item provided.
- The 'category' should be a general classification (e.g., Alimentaire, Entretien, Hygiène, Bricolage, Pharmacie).
- The 'aisle' should be a more specific location within a typical supermarket (e.g., Fruits & Légumes, Boulangerie, Produits Laitiers, Surgelés, Conserves, Boissons).
- If an item doesn't fit a common category/aisle, use your best judgment or use 'Autres'.
- Your response MUST be ONLY a valid JSON array of objects. Each object must contain the original 'id', and the inferred 'category' and 'aisle' strings. Do not add any other text or explanations.`;

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          category: { type: Type.STRING },
          aisle: { type: Type.STRING },
        },
        required: ['id', 'category', 'aisle'],
      },
    };

    const contents = `Categorize the following items:\n${JSON.stringify(items)}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const jsonText = response.text;
    const categorizedItems = JSON.parse(jsonText);
    
    // Basic validation
    if (Array.isArray(categorizedItems) && categorizedItems.every(item => item.id && item.category && item.aisle)) {
        return categorizedItems;
    }
    console.warn("AI categorization did not return a valid array:", categorizedItems);
    return [];

  } catch (error) {
    console.error("Error calling Gemini API for shopping categorization:", error);
    throw new Error("Failed to categorize shopping items.");
  }
};

export const suggestStoreType = async (itemName: string): Promise<string> => {
    try {
        const systemInstruction = `For a shopping item, suggest the most relevant Google Places API type from this list: supermarket, hardware_store, pharmacy, liquor_store, book_store, clothing_store, electronics_store, department_store, convenience_store. If no specific type matches well, respond with "store". Your response MUST be ONLY the type string.`;
        
        const contents = `Shopping item: "${itemName}"`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
            },
        });
        
        return response.text.trim() || 'store';
    } catch (error) {
        console.error("Error suggesting store type:", error);
        return 'store'; // Fallback
    }
};