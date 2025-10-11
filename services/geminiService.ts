import { Type } from "@google/genai";
import { OrganizedData, CustomList, TodoItem, ShoppingItem, NoteItem, CalendarEvent, FullEmail } from '../types';
import { ai } from './aiClient';
import * as googleMailService from './googleMailService';

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
    
    let systemInstruction = "You are an intelligent personal assistant. Your task is to analyze user input and categorize it into 'todos', 'shopping', 'notes', and 'events'. For 'todos', infer a priority ('high', 'medium', 'low') and a 'dueDate' (in YYYY-MM-DD format if mentioned). For 'notes', format the content using HTML tags (<b>, <i>, <ul>, <li>, <table>, etc.) to represent lists, tables, and text formatting. When creating tables, ensure that all <td> cells are filled with the relevant text. For 'events', infer the title and the full start and end date-times in ISO 8601 format. For all items, generate output strictly following the JSON schema. Do not add extra text.";
    
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
    const contents = `Analyze and categorize the following text: "${userInput}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config,
    });
    // FIX: According to the new guidelines, response.text should be accessed directly.
    const jsonText = response.text;
    return parseAndStructureResponse(jsonText, customLists);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to organize input. Please check your input or API key.");
  }
};

export const organizePhotoInput = async (base64ImageData: string, customLists: CustomList[] = []): Promise<OrganizedData> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType: 'image/jpeg',
                data: base64ImageData,
            },
        };

        const customListPromptParts: string[] = [];
        if (customLists.length > 0) {
            customLists.forEach(list => {
                const propertyKey = sanitizeTitleForKey(list.title);
                const fieldNames = list.fields.map(f => `'${f.name}' (as key '${sanitizeTitleForKey(f.name)}')`);
                let instruction = `- For list '${list.title}', use the JSON key '${propertyKey}'. Each item should have 'item' (string) and 'completed' (boolean, false).`;
                if (fieldNames.length > 0) {
                    instruction += ` It also has custom fields: ${fieldNames.join(', ')}.`;
                }
                customListPromptParts.push(instruction);
            });
        }

        const textPart = {
            text: `Analyze the text in this image. Your response MUST be a single, valid JSON object. Do not add any surrounding text, markdown, or explanations.
The JSON object should have keys for 'todos', 'shopping', and 'notes'. If you find items for custom lists, add keys for them as well.

Here are the rules for each key:
- 'todos': An array of objects. Each object must have 'task' (string), 'completed' (boolean, always false), and 'priority' ('high', 'medium', or 'low'). Include 'dueDate' (string, YYYY-MM-DD format) if inferable.
- 'shopping': An array of objects. Each object must have 'item' (string) and 'completed' (boolean, always false).
- 'notes': An array of objects. Each object must have 'content' (string). Use HTML tags (<ul>, <li>, <table>, <td>) for formatting. If you create a table, you MUST populate the <td> cells with text.
${customListPromptParts.length > 0 ? `\nHere are the rules for custom lists:\n${customListPromptParts.join('\n')}` : ''}
`,
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
            },
        });
        
        let jsonText = response.text;
        // The model might still wrap the response in markdown, so we clean it up.
        const jsonMatch = jsonText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            jsonText = jsonMatch[1];
        }

        return parseAndStructureResponse(jsonText, customLists);

    } catch (error) {
        console.error("Error calling Gemini API with image:", error);
        throw new Error("Failed to organize photo. The AI could not read the text or an error occurred.");
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

export const summarizeEmail = async (subject: string, body: string): Promise<string> => {
    try {
        const systemInstruction = "You are an expert email summarizer. Your task is to generate a very short, one-sentence summary of the provided email content. The summary should be concise and capture the main point of the email. Respond ONLY with the summary sentence, without any prefixes like 'Summary:' or explanations.";
        
        const truncatedBody = body.length > 2000 ? body.substring(0, 2000) + "..." : body;

        const contents = `Summarize the following email:\n\nSubject: ${subject}\n\nBody:\n${truncatedBody}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                systemInstruction,
            },
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API for email summarization:", error);
        return "Could not generate summary.";
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
    
    // Simple text conversion for AI
    const emailBodyText = email.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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

export const interpretSearchQuery = async (query: string): Promise<{ gmail?: string; calendar?: string; }> => {
    try {
        const systemInstruction = `You are a search query interpreter. Analyze the user's natural language query and translate it into specific, structured search queries for Google services.
- For Gmail, use Gmail's advanced search operators (e.g., from:, to:, subject:, has:attachment, after:, before:).
- For Google Calendar, provide keywords that would best match event titles or descriptions.
- If a part of the query doesn't map well to a service, omit that key.
- Respond ONLY with the JSON object. Do not add explanations.`;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                gmail: {
                    type: Type.STRING,
                    description: "The structured search query for Gmail."
                },
                calendar: {
                    type: Type.STRING,
                    description: "Keywords for searching Google Calendar."
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
        console.error("Error calling Gemini API for search interpretation:", error);
        // Fallback to a simple query if AI fails
        return { gmail: query, calendar: query };
    }
};