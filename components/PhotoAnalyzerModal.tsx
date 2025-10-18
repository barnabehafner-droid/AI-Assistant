import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XMarkIcon, LoaderIcon, CameraIcon, ArrowUpTrayIcon, SparklesIcon, CheckIcon, UserPlusIcon, CalendarIcon, PencilIcon } from './icons';
import { analyzeImageAndSuggestAction, sanitizeTitleForKey } from '../services/geminiService';
import { OrganizedData, CustomList, Priority, ShoppingItem } from '../types';
import { QueuedItem, ListType } from '../hooks/useOrganizerState';
import { findBestMatch } from '../utils/fuzzyMatching';

type AnalysisResult = {
    intent: 'ORGANIZE_LISTS' | 'CHECK_SHOPPING_LIST' | 'CREATE_CONTACT' | 'CREATE_EVENT' | 'CREATE_EMAIL';
    organizedData?: OrganizedData;
    shoppingItems?: string[];
    contact?: { name: string; email?: string; phone?: string };
    event?: { summary: string; start: { dateTime: string }; end: { dateTime: string }; location?: string; description?: string };
    email?: { recipient?: string; subject?: string; body: string };
};

interface PhotoAnalyzerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAnalyzedItems: (queue: QueuedItem[]) => void;
  customLists: CustomList[];
  shoppingList: ShoppingItem[];
  onCheckShoppingListItems: (itemIds: string[]) => void;
  onCreateContact: (contact: { name: string; email?: string; phone?: string; }) => void;
  onCreateEvent: (event: any) => void;
  onCreateEmail: (email: { recipient?: string; subject?: string; body: string; }) => void;
}

interface EditableItem {
    id: string; // Temp ID
    text: string;
    originalListType: ListType | 'notes';
    originalListId?: string; // For custom lists
    destinationListKey: string; // 'todos', 'shopping', list.id for custom
    included: boolean;
    priority?: Priority; // For todos
    dueDate?: string | null; // For todos
    customFields?: Record<string, string>; // For custom items
}

const PhotoAnalyzerModal: React.FC<PhotoAnalyzerModalProps> = ({ isOpen, onClose, onAddAnalyzedItems, customLists, shoppingList, onCheckShoppingListItems, onCreateContact, onCreateEvent, onCreateEmail }) => {
    const [stage, setStage] = useState<'capturing' | 'confirming' | 'loading' | 'results' | 'error'>('capturing');
    const [capturedImages, setCapturedImages] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startCamera = useCallback(async () => {
        stopCamera();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Camera access denied:", err);
            setError("L'accès à la caméra est nécessaire. Veuillez l'autoriser dans les paramètres de votre navigateur.");
            setStage('error');
        }
    }, [stopCamera]);

    useEffect(() => {
        if (isOpen) {
            if (stage === 'capturing') {
                startCamera();
            } else {
                stopCamera();
            }
        } else {
            stopCamera();
        }
    }, [isOpen, stage, startCamera, stopCamera]);

    useEffect(() => {
        if (!isOpen) {
            // Full reset when modal is closed
            setStage('capturing');
            setCapturedImages([]);
            setError(null);
            setEditableItems([]);
            setAnalysisResult(null);
        }
    }, [isOpen]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImages(prev => [...prev, dataUrl]);
                setStage('confirming');
            }
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                const dataUrl = loadEvent.target?.result as string;
                setCapturedImages(prev => [...prev, dataUrl]);
                setStage('confirming');
            };
            reader.readAsDataURL(file);
        }
        if (event.target) {
            event.target.value = '';
        }
    };

    const handleAnalyze = async () => {
        if (capturedImages.length === 0) return;
        setStage('loading');
        setError(null);

        try {
            const base64Datas = capturedImages.map(img => img.split(',')[1]);
            const result = await analyzeImageAndSuggestAction(base64Datas, customLists);
            
            setAnalysisResult(result);

            if (result.intent === 'ORGANIZE_LISTS' && result.organizedData) {
                const newEditableItems: EditableItem[] = [];
                let idCounter = 0;
                const data = result.organizedData;

                data.todos.forEach(item => newEditableItems.push({ id: `item-${idCounter++}`, text: item.task, originalListType: 'todos', destinationListKey: 'todos', included: true, priority: item.priority, dueDate: item.dueDate }));
                data.shopping.forEach(item => newEditableItems.push({ id: `item-${idCounter++}`, text: item.item, originalListType: 'shopping', destinationListKey: 'shopping', included: true }));
                data.notes.forEach(item => newEditableItems.push({ id: `item-${idCounter++}`, text: item.content, originalListType: 'notes', destinationListKey: 'notes', included: true }));
                
                customLists.forEach(list => {
                    const key = sanitizeTitleForKey(list.title);
                    if (data[key]) {
                        data[key].forEach((item: any) => newEditableItems.push({ id: `item-${idCounter++}`, text: item.item, originalListType: 'custom', originalListId: list.id, destinationListKey: list.id, included: true, customFields: item.customFields }));
                    }
                });

                setEditableItems(newEditableItems);
            }
            setStage('results');

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Une erreur est survenue lors de l'analyse.");
            setStage('error');
        }
    };

    const handleItemChange = (id: string, newValues: Partial<EditableItem>) => {
        setEditableItems(prev => prev.map(item => item.id === id ? { ...item, ...newValues } : item));
    };

    const handleAddItems = () => {
        const queue: QueuedItem[] = [];
        editableItems.filter(i => i.included).forEach(item => {
            const destination = item.destinationListKey;
            if (destination === 'todos') {
                queue.push({ type: 'todos', content: { task: item.text, priority: item.priority || Priority.Medium, dueDate: item.dueDate } });
            } else if (destination === 'shopping') {
                queue.push({ type: 'shopping', content: { item: item.text } });
            } else if (destination === 'notes') {
                queue.push({ type: 'notes', content: { content: item.text } });
            } else { // Custom list
                queue.push({ type: 'custom', listId: destination, content: { item: item.text, customFields: item.customFields } });
            }
        });
        onAddAnalyzedItems(queue);
        onClose();
    };

    const handleRemoveImage = (indexToRemove: number) => {
        const newImages = capturedImages.filter((_, index) => index !== indexToRemove);
        setCapturedImages(newImages);
        if (newImages.length === 0) {
            setStage('capturing');
        }
    };

    const listOptions = [
        { key: 'todos', name: 'To-Do List' },
        { key: 'shopping', name: 'Shopping List' },
        { key: 'notes', name: 'Notes' },
        ...customLists.map(l => ({ key: l.id, name: l.title })),
    ];

    const renderCapture = () => (
        <>
            <div className="relative flex-grow bg-black flex items-center justify-center overflow-hidden">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
            </div>
            <div className="p-4 border-t flex justify-center items-center gap-12 bg-slate-50">
                <button 
                    onClick={handleUploadClick}
                    className="w-16 h-16 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-300 transition-colors"
                    aria-label="Upload an image"
                >
                    <ArrowUpTrayIcon className="w-8 h-8" />
                </button>
                <button 
                    onClick={handleCapture} 
                    className="w-20 h-20 rounded-full bg-white border-4 border-slate-300 hover:border-indigo-500 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-300"
                    aria-label="Take photo"
                />
                <div className="w-16 h-16" /> {/* Placeholder for balance */}
            </div>
             <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
            />
        </>
    );

    const renderConfirm = () => (
         <>
            <div className="flex-grow p-4 overflow-y-auto bg-slate-100">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                    {capturedImages.map((imgSrc, index) => (
                        <div key={index} className="relative aspect-square group shadow-md">
                            <img src={imgSrc} alt={`Capture ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                            <button onClick={() => handleRemoveImage(index)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80" aria-label={`Remove image ${index+1}`}>
                                <XMarkIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-4 border-t flex justify-between items-center bg-slate-50">
                {capturedImages.length < 10 ? (
                    <button onClick={() => setStage('capturing')} className="px-4 py-2 bg-slate-200 text-slate-800 font-semibold rounded-lg hover:bg-slate-300 transition-colors">
                        Ajouter une photo
                    </button>
                ) : <div />}
                 <button onClick={handleAnalyze} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5"/>
                    Analyser ({capturedImages.length})
                </button>
            </div>
        </>
    );

    const renderLoading = () => (
        <div className="flex-grow flex flex-col items-center justify-center gap-4 text-slate-600">
            <LoaderIcon className="w-12 h-12" />
            <p className="text-lg font-semibold">Analyse de l'image en cours...</p>
        </div>
    );
    
    const renderError = () => (
        <div className="flex-grow flex flex-col items-center justify-center gap-4 text-red-600 p-6 text-center">
            <h3 className="text-xl font-bold">Erreur</h3>
            <p>{error}</p>
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-slate-200 text-slate-800 font-bold rounded-lg hover:bg-slate-300 transition-colors">
                Fermer
            </button>
        </div>
    );

    const renderOrganizeLists = () => (
         <>
            <div className="flex-grow p-6 overflow-y-auto space-y-4">
                {editableItems.length > 0 ? (
                    <ul className="space-y-3">
                        {editableItems.map(item => (
                            <li key={item.id} className="flex items-start gap-3 p-3 bg-slate-100 rounded-lg">
                                <input
                                    type="checkbox"
                                    checked={item.included}
                                    onChange={(e) => handleItemChange(item.id, { included: e.target.checked })}
                                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0 mt-2"
                                />
                                <div className="flex-grow min-w-0">
                                    {item.destinationListKey === 'notes' ? (
                                        <textarea
                                            value={item.text}
                                            onChange={(e) => handleItemChange(item.id, { text: e.target.value })}
                                            className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                            rows={4}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            value={item.text}
                                            onChange={(e) => handleItemChange(item.id, { text: e.target.value })}
                                            className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"
                                        />
                                    )}
                                </div>
                                <select 
                                    value={item.destinationListKey} 
                                    onChange={(e) => handleItemChange(item.id, { destinationListKey: e.target.value })}
                                    className="p-2 text-sm border-slate-300 rounded-lg bg-slate-50 focus:ring-indigo-500 focus:border-indigo-500 flex-shrink-0 mt-1"
                                >
                                    {listOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.name}</option>)}
                                </select>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-slate-500 py-10">Aucun élément n'a été détecté.</p>
                )}
            </div>
            <div className="p-4 border-t flex justify-end">
                <button onClick={handleAddItems} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors" disabled={editableItems.filter(i => i.included).length === 0}>
                    Ajouter aux listes
                </button>
            </div>
        </>
    );

    const renderCheckShoppingList = () => {
        const itemsToCheck = analysisResult?.shoppingItems || [];
        const matches = itemsToCheck.map(itemName => {
            const match = findBestMatch(shoppingList, itemName, 'item', 0.6);
            return { found: itemName, match };
        }).filter(m => m.match && !m.match.completed);

        const handleConfirm = () => {
            onCheckShoppingListItems(matches.map(m => m.match!.id));
            onClose();
        };

        return (
            <>
                <div className="p-6 overflow-y-auto">
                    <p className="text-slate-600 mb-4">L'IA a trouvé les articles suivants. Voulez-vous les cocher dans votre liste de courses ?</p>
                    {matches.length > 0 ? (
                        <ul className="space-y-2 max-h-60 overflow-y-auto p-3 border rounded-md bg-slate-50">
                            {matches.map(({ found, match }, index) => (
                                <li key={index} className="flex items-center gap-3 p-2 bg-white rounded">
                                    <CheckIcon className="w-5 h-5 text-green-500"/>
                                    <div>
                                        <p className="font-semibold text-slate-800">{match!.item}</p>
                                        <p className="text-xs text-slate-500">(Détecté : "{found}")</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-center text-slate-500 py-10">Aucun article correspondant non coché n'a été trouvé dans votre liste.</p>
                    )}
                </div>
                 <div className="p-4 border-t flex justify-end">
                    <button onClick={handleConfirm} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors" disabled={matches.length === 0}>
                        Cocher {matches.length} article(s)
                    </button>
                </div>
            </>
        );
    };

    const renderCreateContact = () => {
        const contact = analysisResult?.contact;
        if (!contact) return renderError();
        return (
             <>
                <div className="p-6 overflow-y-auto space-y-4">
                    <p className="text-slate-600 mb-4">L'IA a détecté les informations de contact suivantes. Créer un nouveau contact ?</p>
                    <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
                        <p><strong className="font-semibold text-slate-600">Nom:</strong> {contact.name}</p>
                        {contact.email && <p><strong className="font-semibold text-slate-600">Email:</strong> {contact.email}</p>}
                        {contact.phone && <p><strong className="font-semibold text-slate-600">Téléphone:</strong> {contact.phone}</p>}
                    </div>
                </div>
                 <div className="p-4 border-t flex justify-end">
                    <button onClick={() => { onCreateContact(contact); onClose(); }} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                        <UserPlusIcon className="w-5 h-5" />
                        Créer le contact
                    </button>
                </div>
            </>
        );
    };

    const renderCreateEvent = () => {
        const event = analysisResult?.event;
        if (!event) return renderError();
        return (
             <>
                <div className="p-6 overflow-y-auto space-y-4">
                     <p className="text-slate-600 mb-4">L'IA a détecté un événement. Voulez-vous l'ajouter à votre agenda ?</p>
                     <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
                        <p><strong className="font-semibold text-slate-600">Titre:</strong> {event.summary}</p>
                        {event.start?.dateTime && <p><strong className="font-semibold text-slate-600">Début:</strong> {new Date(event.start.dateTime).toLocaleString()}</p>}
                        {event.end?.dateTime && <p><strong className="font-semibold text-slate-600">Fin:</strong> {new Date(event.end.dateTime).toLocaleString()}</p>}
                        {event.location && <p><strong className="font-semibold text-slate-600">Lieu:</strong> {event.location}</p>}
                        {event.description && <p><strong className="font-semibold text-slate-600">Description:</strong> {event.description}</p>}
                    </div>
                </div>
                 <div className="p-4 border-t flex justify-end">
                    <button onClick={() => { onCreateEvent(event); onClose(); }} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5" />
                        Ajouter à l'agenda
                    </button>
                </div>
            </>
        );
    };
    
    const renderCreateEmail = () => {
        const email = analysisResult?.email;
        if (!email) return renderError();
        return (
             <>
                <div className="p-6 overflow-y-auto space-y-4">
                     <p className="text-slate-600 mb-4">L'IA a détecté le contenu d'un e-mail. Voulez-vous commencer un nouveau brouillon ?</p>
                     <div className="p-4 border rounded-lg bg-slate-50 space-y-2 max-h-60 overflow-y-auto">
                        {email.recipient && <p><strong className="font-semibold text-slate-600">Destinataire (suggéré):</strong> {email.recipient}</p>}
                        {email.subject && <p><strong className="font-semibold text-slate-600">Sujet (suggéré):</strong> {email.subject}</p>}
                        <p className="whitespace-pre-wrap"><strong className="font-semibold text-slate-600">Contenu:</strong> {email.body}</p>
                    </div>
                </div>
                 <div className="p-4 border-t flex justify-end">
                    <button onClick={() => { onCreateEmail(email); onClose(); }} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                        <PencilIcon className="w-5 h-5" />
                        Composer l'e-mail
                    </button>
                </div>
            </>
        );
    };
    
    const renderResults = () => {
        if (!analysisResult) return renderLoading();
        switch (analysisResult.intent) {
            case 'ORGANIZE_LISTS': return renderOrganizeLists();
            case 'CHECK_SHOPPING_LIST': return renderCheckShoppingList();
            case 'CREATE_CONTACT': return renderCreateContact();
            case 'CREATE_EVENT': return renderCreateEvent();
            case 'CREATE_EMAIL': return renderCreateEmail();
            default: return renderOrganizeLists(); // Fallback to the most general action
        }
    };


    const stageContent = {
        capturing: renderCapture(),
        confirming: renderConfirm(),
        loading: renderLoading(),
        results: renderResults(),
        error: renderError(),
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl m-4 h-[90vh] flex flex-col">
                <header className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-bold text-slate-800">Analyser une photo</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </header>
                {stageContent[stage]}
                 {/* Hidden canvas for image capture */}
                <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
        </div>
    );
};

export default PhotoAnalyzerModal;