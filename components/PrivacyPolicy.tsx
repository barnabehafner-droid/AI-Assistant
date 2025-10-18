import React from 'react';
import { ArrowLeftIcon } from './icons';

interface PrivacyPolicyProps {
    onBack: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
            <button onClick={onBack} className="flex items-center gap-2 text-indigo-600 font-semibold hover:underline mb-8">
                <ArrowLeftIcon className="w-5 h-5" />
                Retour à l'application
            </button>
            <div className="bg-white p-8 sm:p-12 rounded-xl shadow-md">
                <div className="prose">
                    <h1>Politique de Confidentialité et d'Utilisation des Données</h1>
                    <p>Dernière mise à jour : 11/10/2025</p>
                    <p>Cette politique décrit comment l'application Organisateur AI (ci-après “l'Application”) collecte, utilise et protège les données personnelles de ses utilisateurs, en conformité avec le Règlement Général sur la Protection des Données (RGPD) et la Google API Services User Data Policy.</p>
                    <p>
                        <strong>Responsable du traitement :</strong><br />
                        Barnabé Hafner<br />
                        <a href="mailto:barnabe.hafner@gmail.com">barnabe.hafner@gmail.com</a>
                    </p>

                    <h2>1. Services Google et Données Accédées via OAuth 2.0</h2>
                    <p>L'Application utilise l'authentification Google OAuth 2.0 pour fournir les fonctions de synchronisation et d'assistance IA. L'accès est strictement limité aux services nécessaires.</p>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="p-2 border border-slate-200">Service Google</th>
                                <th className="p-2 border border-slate-200">Données accédées</th>
                                <th className="p-2 border border-slate-200">Objectif d'utilisation</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-2 border border-slate-200">Google Drive</td>
                                <td className="p-2 border border-slate-200">Fichier unique <code>organizer-data.json</code> dans <code>appDataFolder</code>.</td>
                                <td className="p-2 border border-slate-200">Stocker et synchroniser les données d'organisation (tâches, listes, notes, projets).</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-200">Gmail</td>
                                <td className="p-2 border border-slate-200">Liste et contenu des messages, sujets, expéditeurs, brouillons.</td>
                                <td className="p-2 border border-slate-200">Gestion de la boîte de réception, rédaction assistée IA, extraction de listes (avec consentement explicite).</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-200">Google Calendar</td>
                                <td className="p-2 border border-slate-200">Calendriers et événements (résumé, description, horaires, rappels).</td>
                                <td className="p-2 border border-slate-200">Gestion de l'agenda : création, modification, suppression et vérification de conflits.</td>
                            </tr>
                            <tr>
                                <td className="p-2 border border-slate-200">Google People</td>
                                <td className="p-2 border border-slate-200">Noms et adresses e-mail des contacts.</td>
                                <td className="p-2 border border-slate-200">Auto-complétion des destinataires et assistance vocale.</td>
                            </tr>
                        </tbody>
                    </table>

                    <h2>2. Base Juridique du Traitement</h2>
                    <p>Les traitements reposent sur :</p>
                    <ul>
                        <li>le <strong>consentement explicite</strong> (connexion OAuth, activation de fonctionnalités) ;</li>
                        <li>et/ou l'<strong>exécution du contrat</strong>, nécessaire à la fourniture du service.</li>
                    </ul>
                    <p>Le consentement peut être retiré à tout moment depuis les paramètres du compte Google.</p>

                    <h2>3. Utilisation et Traitement des Données par l'IA</h2>
                    <p>Les données collectées servent exclusivement au fonctionnement de l'Application.</p>
                    <h3>a. Analyse de contenu</h3>
                    <p>L'IA organise textes, photos et e-mails en tâches, listes ou notes.</p>
                    <h3>b. Assistant vocal</h3>
                    <p>Le flux audio est capturé pour exécuter les commandes vocales. Aucun enregistrement n'est conservé.</p>
                    <h3>c. Assistant vidéo</h3>
                    <p>En mode multimodal, des images (converties en Base64) et sons sont analysés en temps réel pour OCR ou détection d'objets. Rien n'est stocké.</p>
                    <h3>d. Personnalisation du style</h3>
                    <p>L'analyse du style d'écriture est <strong>optionnelle</strong> et activée uniquement à la demande explicite de l'utilisateur.</p>

                    <h2>4. Gestion et Sécurité des Données</h2>
                    <ul>
                        <li>Stockage exclusif dans le <code>appDataFolder</code> du Drive de l'utilisateur.</li>
                        <li>Aucune copie n'est conservée par le développeur.</li>
                        <li>Communications chiffrées (HTTPS).</li>
                        <li>Cache local (localStorage) vidé à chaque synchronisation.</li>
                    </ul>

                    <h2>5. Règles de Fonctionnement Spécifiques</h2>
                    <p><strong>Vérification des conflits d'agenda :</strong> tout nouvel événement est contrôlé via <code>checkForCalendarConflicts</code>, et nécessite confirmation en cas de chevauchement.</p>
                    <p><strong>Liaison de projet par IA :</strong> l'association d'un élément à un projet existant n'a lieu qu'après accord explicite de l'utilisateur.</p>

                    <h2>6. Conformité à la Google API Services User Data Policy</h2>
                    <p>L'Application respecte la politique “Limited Use” :</p>
                    <ul>
                        <li>Utilisation uniquement pour les fonctionnalités demandées ;</li>
                        <li>Aucune vente, partage ni transfert à des tiers ;</li>
                        <li>Aucun usage publicitaire ou de profilage.</li>
                    </ul>

                    <h2>7. Droits des Utilisateurs (RGPD)</h2>
                    <p>Les utilisateurs disposent des droits d'accès, rectification, suppression, opposition, limitation, portabilité et retrait du consentement.</p>
                    <p>
                        <strong>Exercice des droits :</strong><br />
                        <a href="mailto:barnabe.hafner@gmail.com">barnabe.hafner@gmail.com</a>
                    </p>
                    <p>
                        <strong>Révocation des accès OAuth :</strong><br />
                        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">https://myaccount.google.com/permissions</a>
                    </p>

                    <h2>8. Transfert de Données hors UE</h2>
                    <p>Les services Google et Gemini peuvent traiter des données hors de l'EEE. Google applique les <strong>clauses contractuelles types</strong> approuvées par la Commission européenne pour garantir la conformité RGPD.</p>

                    <h2>9. Absence d'Utilisation Publicitaire</h2>
                    <p>Les données ne sont <strong>jamais utilisées à des fins publicitaires ou commerciales</strong>, ni partagées avec des partenaires externes.</p>

                    <h2>10. Conservation et Suppression</h2>
                    <p>Les données sont conservées tant que l'accès OAuth reste actif. En cas de révocation ou suppression de l'application, tout accès et cache local sont immédiatement supprimés.</p>

                    <h2>11. Contact et Réclamations</h2>
                    <p>
                        Pour toute question ou exercice de droits :<br />
                        <a href="mailto:barnabe.hafner@gmail.com">barnabe.hafner@gmail.com</a>
                    </p>
                    <p>
                        Réclamations : Autorité de Protection des Données (APD) – Belgique.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;