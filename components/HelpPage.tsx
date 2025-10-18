import React, { useState, useRef } from 'react';
import { ArrowLeftIcon, XMarkIcon, ChevronDownIcon, MagnifyingGlassIcon, LoaderIcon, PlusIcon, CalendarIcon, ArrowUturnLeftIcon, CheckIcon, LinkIcon, CameraIcon, VideoCameraIcon, Cog6ToothIcon, PencilIcon, ArrowPathIcon, SparklesIcon, SignalIcon } from './icons';
import { searchFaq } from '../services/geminiService';

interface HelpPageProps {
    onBack: () => void;
}

const HelpModal: React.FC<{ title: string; content: React.ReactNode; onClose: () => void }> = ({ title, content, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl m-4 flex flex-col max-h-[85vh] animate-fade-in">
            <header className="flex items-center justify-between p-6 border-b flex-shrink-0">
                <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-800">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </header>
            <div className="p-6 sm:p-8 overflow-y-auto">
                <div className="prose max-w-none">
                    {content}
                </div>
            </div>
            <footer className="p-4 bg-slate-50 border-t flex justify-end flex-shrink-0">
                <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                    Fermer
                </button>
            </footer>
        </div>
    </div>
);

const AccordionItem: React.FC<{ title: string; children: React.ReactNode; isOpen: boolean; onToggle: () => void; id: string }> = ({ title, children, isOpen, onToggle, id }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <div className="border-b border-slate-200" id={id}>
      <h3 className="m-0">
        <button
          onClick={onToggle}
          className="flex justify-between items-center w-full py-4 text-left font-semibold text-slate-800 hover:bg-slate-50 px-2 rounded-md"
          aria-expanded={isOpen}
        >
          <span>{title}</span>
          <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      <div
        ref={contentRef}
        className="accordion-content"
        style={{
          maxHeight: isOpen ? `${contentRef.current?.scrollHeight}px` : '0px',
        }}
      >
        <div className="pb-4 px-2 text-slate-600">{children}</div>
      </div>
    </div>
  );
};


const HelpPage: React.FC<HelpPageProps> = ({ onBack }) => {
    const [isManualOpen, setIsManualOpen] = useState(false);
    const [isFaqOpen, setIsFaqOpen] = useState(false);
    const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
    const [faqQuery, setFaqQuery] = useState('');
    const [isFaqSearching, setIsFaqSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<string | null>(null);


    const manualContent = (
      <>
          <p className="!text-lg !text-slate-600">Votre assistant intelligent pour organiser, planifier et simplifier votre quotidien.</p>

          <div className="flex items-center gap-3 mt-8">
              <span className="text-2xl">🚀</span>
              <h3 className="!mt-0 !mb-0">Introduction</h3>
          </div>
          <p>Bienvenue dans Al Assistant, votre compagnon personnel conçu pour comprendre vos besoins en langage naturel. Grâce à lui, vous pouvez ajouter des tâches, planifier vos journées, gérer vos projets, ou encore discuter vocalement avec une IA qui apprend votre style et vos habitudes.</p>

          <hr className="my-8" />

          <div className="flex items-center gap-3">
              <span className="text-2xl">🧠</span>
              <h3 className="!mt-0 !mb-0">1. Saisie Rapide & Organisation Automatique</h3>
          </div>
          <h4>Le principe</h4>
          <p>La barre de saisie principale est le cœur de l'application. Tapez simplement ce que vous voulez faire — comme si vous parliez à un assistant humain — et l'IA comprend, trie et classe automatiquement vos idées.</p>

          <div className="not-prose my-6 space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-4 font-semibold text-slate-600 border-b pb-2">
                <div>Action</div>
                <div>Comment faire ?</div>
                <div>Ce qu'il se passe</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center py-2">
                <div className="flex items-center gap-2 font-medium text-slate-700"><PlusIcon className="w-5 h-5 text-indigo-500"/>Ajouter des éléments</div>
                <div>Tapez : "Acheter du pain et envoyer un e-mail à Jane."</div>
                <div>L'IA ajoute "Acheter du pain” à la liste Courses et "Envoyer un e-mail à Jane" dans Tâches.</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center py-2">
                <div className="flex items-center gap-2 font-medium text-slate-700"><CalendarIcon className="w-5 h-5 text-indigo-500"/>Créer un événement</div>
                <div>Ex. : "Réunion avec John demain à 14h pour une heure."</div>
                <div>L'IA le place dans votre Google Agenda (si connecté).</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center py-2">
                <div className="flex items-center gap-2 font-medium text-slate-700">⚠️ Gérer les doublons</div>
                <div>Si un élément existe déjà, l'appli vous le signale.</div>
                <div>Vous pouvez choisir : Annuler, Ajouter quand même, ou Fusionner & Ouvrir.</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center py-2">
                <div className="flex items-center gap-2 font-medium text-slate-700"><ArrowUturnLeftIcon className="w-5 h-5 text-indigo-500"/>Annuler une erreur</div>
                <div>Après une suppression ou modification.</div>
                <div>Cliquez sur Annuler dans la petite notification (UndoToast).</div>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
              <p className="!my-0"><strong>💡 Astuce :</strong> Vous pouvez mélanger plusieurs actions dans une seule phrase. L'IA analysera tout (<code>organizeInput</code>).</p>
          </div>

          <hr className="my-8" />
          
          <div className="flex items-center gap-3">
              <span className="text-2xl">🗣️</span>
              <h3 className="!mt-0 !mb-0">2. L'Assistant Vocal Conversationnel</h3>
          </div>
          <h4>Activer le chat vocal</h4>
          <p>Appuyez sur le bouton de chat (micro ou bulle) pour parler à votre assistant.</p>
          <ul>
            <li><strong>Un clic court →</strong> discussion classique.</li>
            <li><strong>Un appui long →</strong> démarrage en mode “l'IA parle d'abord”, avec un petit résumé vocal de votre journée ou des tâches à venir.</li>
          </ul>
          <h4>Fonctions vocales principales</h4>
           <div className="not-prose my-6 space-y-4 text-sm">
             <div className="grid grid-cols-3 gap-4 font-semibold text-slate-600 border-b pb-2">
                <div>Fonction</div>
                <div>Exemple de commande</div>
                <div>Ce que fait l'IA</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center py-2">
                <div className="flex items-center gap-2 font-medium text-slate-700"><CheckIcon className="w-5 h-5 text-green-500"/>Organisation de tâches</div>
                <div>"Ajoute 'appeler le client'" ou "Coche 'acheter du lait'."</div>
                <div>L'IA identifie la tâche même si vous faites une faute grâce à une correspondance floue (distance de Levenshtein).</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center py-2">
                <div className="font-medium text-slate-700">Listes personnalisées</div>
                <div>"Ajoute 'sauvignon blanc' à ma liste 'Vins'."</div>
                <div>L'IA cherche la meilleure correspondance pour la liste nommée.</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center py-2">
                <div className="flex items-center gap-2 font-medium text-slate-700"><CalendarIcon className="w-5 h-5 text-blue-500"/>Vérification d'agenda</div>
                <div>"Suis-je libre mercredi à 10h ?"</div>
                <div>L'IA vérifie les conflits avant d'ajouter un nouvel événement.</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center py-2">
                <div className="font-medium text-slate-700">E-mails (via Gmail)</div>
                <div>"Cherche les e-mails de mon patron."</div>
                <div>L'IA recherche, lit, ou rédige des brouillons. Vous pouvez aussi convertir un e-mail en note.</div>
            </div>
            <div className="grid grid-cols-3 gap-4 items-center py-2">
                <div className="font-medium text-slate-700">Filtrage intelligent</div>
                <div>"Montre mes tâches urgentes" / "Affiche les articles 'bio'."</div>
                <div>L'IA applique des filtres temporaires sur vos listes.</div>
            </div>
          </div>
          <p><SignalIcon className="w-4 h-4 inline-block mr-1"/>L'onde sonore sur le bouton indique que l'IA vous écoute ou parle (isAiSpeaking).</p>

          <hr className="my-8" />

          <div className="flex items-center gap-3">
              <span className="text-2xl">🗂️</span>
              <h3 className="!mt-0 !mb-0">3. Gestion des Projets & Planification AI</h3>
          </div>
          <h4>Le Tableau de Bord des Projets</h4>
          <p>Centralisez vos grands objectifs et suivez leur progression visuellement.</p>
          <h4 className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-500"/>Planificateur de Projet AI</h4>
          <ol>
            <li>Cliquez sur "Planifier un projet avec l'IA”.</li>
            <li>Décrivez votre but : “Organiser un voyage de 2 semaines au Japon.”</li>
            <li>L'IA vous pose quelques questions.</li>
            <li>Résultat : un plan détaillé avec tâches, notes et articles liés.</li>
          </ol>
          <h4>Suivi et progression</h4>
          <p>Chaque carte de projet affiche son avancement, calculé automatiquement à partir des tâches terminées.</p>
          <h4 className="flex items-center gap-2"><LinkIcon className="w-5 h-5 text-indigo-500"/>Lier des éléments</h4>
          <p>Depuis une carte projet, cliquez sur l'icône de lien pour relier des tâches, notes ou articles existants.</p>
          <h4>Détails d'un projet ou d'une tâche</h4>
          <h5>Assistant de Sous-Tâches</h5>
          <p>Dans une tâche ouverte (TodoDetailModal) → cliquez sur l'icône IA. L'assistant vous aide à la découper en étapes concrètes (“Préparer les murs”, “Choisir la peinture”, etc.).</p>
          <h5>Assistant de Rédaction de Notes</h5>
          <p>Dans une note ouverte (NoteDetailModal) → cliquez sur le micro. L'IA lit votre contenu, propose des reformulations, ajoute des titres ou des tableaux HTML, et peut même reformuler en direct pendant que vous dictez.</p>

          <hr className="my-8" />

          <div className="flex items-center gap-3">
              <span className="text-2xl">🖼️</span>
              <h3 className="!mt-0 !mb-0">4. Outils Visuels et Multimédias</h3>
          </div>
          <h4 className="flex items-center gap-2"><CameraIcon className="w-5 h-5 text-blue-500"/>Analyse de Photo (OCR)</h4>
          <ol>
              <li>Cliquez sur l'icône Caméra.</li>
              <li>Choisissez Analyser une photo.</li>
              <li>Prenez ou importez une image (ex : une liste manuscrite).</li>
              <li>L'IA en extrait le texte et vous propose de classer chaque élément avant de les ajouter.</li>
          </ol>
          <p>✓ Idéal pour transformer une photo de notes, de tableau blanc ou de recette en liste organisée.</p>
          <h4 className="flex items-center gap-2"><VideoCameraIcon className="w-5 h-5 text-green-500"/>Chat Vidéo</h4>
          <p>Lancez un chat vocal avec caméra. L'IA voit et comprend ce que vous montrez.</p>
          <p>Exemples :</p>
          <ul>
              <li>"Regarde ma liste sur le frigo et ajoute les articles manquants."</li>
              <li>"Aide-moi à trier ces papiers."</li>
          </ul>
          <p>Une véritable interaction en temps réel, visuelle et parlée.</p>

          <hr className="my-8" />
          
          <div className="flex items-center gap-3">
              <Cog6ToothIcon className="w-6 h-6 text-slate-600"/>
              <h3 className="!mt-0 !mb-0">5. Paramètres & Personnalisation</h3>
          </div>
          <h4>Personnalité de l'Assistant</h4>
          <p>Réglez le ton et le style de votre IA selon vos préférences :</p>
          <ul>
              <li><strong>Voix :</strong> Zephyr, Puck, Kore, etc.</li>
              <li><strong>Ton :</strong> Ludique, Sérieux, Professionnel.</li>
              <li><strong>Politesse :</strong> Tutoiement ou vouvoiement.</li>
              <li><strong>Initiative :</strong> Réactive ou Proactive.</li>
          </ul>
          <p>Vous pouvez aussi définir des règles absolues :<br/><em>"Parle toujours en rimes."<br/>"Ne donne jamais d'exemples de code."</em><br/>Un bouton ✨ vous aide à reformuler ces règles pour plus de clarté.</p>
          <h4 className="flex items-center gap-2"><PencilIcon className="w-5 h-5 text-orange-500"/>Style d'Écriture</h4>
          <p>L'IA peut analyser vos derniers e-mails (si vous l'autorisez via Gmail) afin de rédiger des messages ou des notes dans votre ton naturel.</p>
          <h4 className="flex items-center gap-2"><ArrowPathIcon className="w-5 h-5 text-cyan-500"/>Synchronisation & Sécurité</h4>
          <p>Vos données sont :</p>
          <ul>
              <li>enregistrées localement sur votre appareil,</li>
              <li>synchronisées en temps réel (toutes les 2,5 secondes) avec votre Google Drive.</li>
          </ul>
          <p>Un bouton Actualiser permet de forcer une resynchronisation immédiate. Aucune donnée n'est partagée sans votre autorisation explicite.</p>
          <h4 className="flex items-center gap-2"><MagnifyingGlassIcon className="w-5 h-5 text-gray-500"/>Recherche Globale</h4>
          <p>La loupe en haut de l'écran ouvre une recherche universelle. Vous pouvez trouver n'importe quel élément : tâche, projet, e-mail, note ou événement — le tout en une seule requête.</p>

          <hr className="my-8" />

          <div className="flex items-center gap-3">
              <span className="text-2xl">💡</span>
              <h3 className="!mt-0 !mb-0">En Résumé</h3>
          </div>
          <p>Al Assistant n'est pas seulement une application : c'est un assistant intelligent, visuel, vocal et adaptable, conçu pour s'intégrer naturellement dans votre façon de travailler et de penser.</p>
      </>
    );

    const faqItems = [
        {
            question: "Où sont stockées mes données ?",
            answer: <p>Vos données sont stockées de deux manières : dans le cache de votre navigateur pour un accès rapide et hors ligne, et de manière sécurisée dans votre propre compte Google Drive. L'application utilise un dossier spécial (AppData) auquel seule elle a accès. Nous n'avons aucun accès à vos données.</p>
        },
        {
            question: "L'assistant vocal ne me comprend pas bien, que faire ?",
            answer: <p>Parlez de manière claire et naturelle. Si une commande échoue, essayez de la reformuler. Vous pouvez également personnaliser le comportement de l'assistant (ton, formalité) dans les paramètres (icône d'engrenage dans le menu de votre profil) pour qu'il corresponde mieux à vos attentes.</p>
        },
        {
            question: "Puis-je utiliser l'application hors ligne ?",
            answer: <p>Oui. Grâce au stockage local, vous pouvez consulter et modifier vos listes même sans connexion internet. Les modifications seront synchronisées avec votre Google Drive dès que vous serez de nouveau en ligne.</p>
        },
        {
            question: "Comment ajouter des champs à une liste personnalisée ?",
            answer: <p>Actuellement, les champs personnalisés ne peuvent être définis qu'à la création d'une nouvelle liste. Nous travaillons à rendre cette fonctionnalité plus flexible.</p>
        }
    ];

    const handleToggleFaq = (index: number) => {
        setOpenFaqIndex(openFaqIndex === index ? null : index);
    };

    const handleFaqSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!faqQuery.trim()) return;

        setIsFaqSearching(true);
        setSearchResult(null);
        setOpenFaqIndex(null);

        try {
            const result = await searchFaq(faqQuery, faqItems.map(i => ({ question: i.question })));
            
            if (result.matchedIndex !== undefined) {
                setOpenFaqIndex(result.matchedIndex);
                 const element = document.getElementById(`faq-item-${result.matchedIndex}`);
                if (element) {
                    setTimeout(() => element.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); // Wait for accordion to open
                }
            } else if (result.generatedAnswer) {
                setSearchResult(result.generatedAnswer);
            }
        } catch (error) {
            console.error(error);
            setSearchResult("Désolé, une erreur est survenue lors de la recherche.");
        } finally {
            setIsFaqSearching(false);
        }
    };
    
    const faqContent = (
         <div className="not-prose">
            <form onSubmit={handleFaqSearch} className="mb-6 flex gap-2">
                <div className="relative flex-grow">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        value={faqQuery}
                        onChange={(e) => setFaqQuery(e.target.value)}
                        placeholder="Posez une question sur l'application..."
                        className="w-full pl-10 pr-4 py-2 text-base bg-slate-100 border border-transparent rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none transition"
                        autoFocus
                    />
                </div>
                <button
                    type="submit"
                    disabled={isFaqSearching}
                    className="px-4 py-2 font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center justify-center w-28"
                >
                    {isFaqSearching ? <LoaderIcon className="w-5 h-5"/> : 'Rechercher'}
                </button>
            </form>

            {searchResult && (
                <div className="mb-6 p-4 bg-indigo-50 border-l-4 border-indigo-400 animate-fade-in">
                    <h3 className="font-bold text-indigo-800">Réponse de l'assistant :</h3>
                    <div className="mt-2 text-indigo-900 prose prose-sm max-w-none">{searchResult}</div>
                </div>
            )}

            <div>
                {faqItems.map((item, index) => (
                    <AccordionItem
                        key={index}
                        id={`faq-item-${index}`}
                        title={item.question}
                        isOpen={openFaqIndex === index}
                        onToggle={() => handleToggleFaq(index)}
                    >
                        <div className="prose prose-sm max-w-none">{item.answer}</div>
                    </AccordionItem>
                ))}
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
            <button onClick={onBack} className="flex items-center gap-2 text-indigo-600 font-semibold hover:underline mb-8">
                <ArrowLeftIcon className="w-5 h-5" />
                Retour à l'application
            </button>
            <div className="bg-white p-8 sm:p-12 rounded-xl shadow-md">
                <div className="prose">
                    <h1>Page d'Aide</h1>
                    
                    <h2>Présentation</h2>
                    <p>Bienvenue sur votre Organisateur Personnel IA ! Cette application est conçue pour être votre second cerveau. Elle vous aide à capturer, organiser et gérer vos tâches, listes de courses, notes et projets, le tout dans une interface simple et intelligente. L'objectif est de vous permettre de vous vider l'esprit rapidement, en laissant l'IA faire le tri pour vous.</p>
                </div>

                <div className="mt-12 not-prose space-y-4">
                    <button 
                        onClick={() => setIsManualOpen(true)}
                        className="p-6 bg-slate-50 hover:bg-slate-100 rounded-lg text-left transition-colors border border-slate-200 w-full"
                    >
                        <h3 className="font-bold text-lg text-slate-800">Manuel d'utilisation</h3>
                        <p className="text-sm text-slate-600 mt-2">Découvrez comment utiliser toutes les fonctionnalités, de l'ajout rapide à la gestion de projet.</p>
                    </button>
                    <button 
                        onClick={() => setIsFaqOpen(true)}
                        className="p-6 bg-slate-50 hover:bg-slate-100 rounded-lg text-left transition-colors border border-slate-200 w-full"
                    >
                        <h3 className="font-bold text-lg text-slate-800">Foire Aux Questions</h3>
                        <p className="text-sm text-slate-600 mt-2">Trouvez des réponses à vos questions les plus courantes.</p>
                    </button>
                </div>
            </div>
            {isManualOpen && <HelpModal title="Manuel d'utilisation" content={manualContent} onClose={() => setIsManualOpen(false)} />}
            {isFaqOpen && <HelpModal title="Foire Aux Questions" content={faqContent} onClose={() => setIsFaqOpen(false)} />}
        </div>
    );
};

export default HelpPage;