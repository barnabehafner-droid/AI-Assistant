import React from 'react';
import { ArrowLeftIcon } from './icons';

interface TermsOfUseProps {
    onBack: () => void;
}

const TermsOfUse: React.FC<TermsOfUseProps> = ({ onBack }) => {
    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
            <button onClick={onBack} className="flex items-center gap-2 text-indigo-600 font-semibold hover:underline mb-8">
                <ArrowLeftIcon className="w-5 h-5" />
                Retour à l'application
            </button>
            <div className="bg-white p-8 sm:p-12 rounded-xl shadow-md">
                <div className="prose">
                    <h1>Conditions d’Utilisation</h1>
                    <p>Dernière mise à jour : 11 octobre 2025</p>
                    <p>
                        <strong>Responsable du traitement :</strong> Barnabé Hafner Taymans<br />
                        <strong>Contact RGPD :</strong> barnabe.hafner@gmail.com
                    </p>

                    <h2>I. Exigences d’Accès et d’Authentification</h2>
                    <p>L’utilisateur reconnaît et accepte que l’utilisation de la plupart des fonctionnalités de l’application (synchronisation, planification, messagerie) nécessite une connexion via son compte Google. Cette connexion octroie à l’application un accès distant limité aux services Google décrits ci-dessous, exclusivement pour permettre le fonctionnement des fonctionnalités proposées.</p>

                    <h3>1. Google Drive (Stockage des Données d’Organisation)</h3>
                    <ul>
                        <li><strong>Lieu de stockage :</strong> Toutes vos données d’organisation (tâches, listes, notes, projets, paramètres) sont conservées dans un fichier unique et chiffré, situé dans un dossier privé de votre espace Google Drive — non visible dans l’interface habituelle.</li>
                        <li><strong>Permissions requises :</strong> L’application peut rechercher, lire, créer et mettre à jour ce fichier.</li>
                        <li><strong>Synchronisation :</strong> Le système compare la dernière modification du fichier sur Drive à celle enregistrée localement pour toujours utiliser la version la plus récente.</li>
                    </ul>

                    <h3>2. Gmail (Messagerie Électronique)</h3>
                    <ul>
                        <li><strong>Accès et lecture :</strong> L’application peut lister et rechercher vos e-mails, lire leur contenu complet (corps, sujet, expéditeur) et marquer un message comme lu.</li>
                        <li><strong>Envoi et brouillons :</strong> L’utilisateur autorise l’application à envoyer des e-mails ou à créer/enregistrer des brouillons en son nom.</li>
                        <li><strong>Analyse de style :</strong> L’application peut analyser vos e-mails envoyés afin d’adapter la voix et le ton de l’assistant à votre style d’écriture.</li>
                    </ul>

                    <h3>3. Google Agenda (Calendrier)</h3>
                    <ul>
                        <li><strong>Consultation :</strong> L’application peut lister vos calendriers et événements à venir, ainsi qu’effectuer des recherches.</li>
                        <li><strong>Modification :</strong> Elle peut créer, modifier et supprimer des événements dans les calendriers autorisés.</li>
                        <li><strong>Contrôle proactif :</strong> Avant toute création d’événement, l’IA vérifie les conflits d’horaire et demande confirmation en cas de chevauchement.</li>
                    </ul>

                    <h3>4. Contacts Google (Annuaire)</h3>
                    <ul>
                        <li><strong>Accès aux contacts :</strong> L’application peut lister et rechercher vos contacts (nom et adresse e-mail).</li>
                        <li><strong>Saisie assistée :</strong> Ces informations permettent de proposer des suggestions automatiques de destinataires lors de la rédaction d’e-mails.</li>
                        <li><strong>Retrait des autorisations :</strong> L’utilisateur peut à tout moment révoquer l’accès de l’application aux services Google via les paramètres de son compte Google.</li>
                    </ul>

                    <h2>II. Conditions d’Utilisation de l’Intelligence Artificielle</h2>
                    <p>L’utilisateur comprend que le service repose sur une intelligence artificielle (IA) pour analyser, interpréter et générer du contenu textuel, vocal ou visuel. Ces fonctions sont soumises aux conditions suivantes.</p>
                    
                    <h3>1. Types de Données Soumises à l’IA</h3>
                    <p>L’utilisateur accepte que les données suivantes puissent être transmises à l’IA :</p>
                    <ul>
                        <li><strong>Saisie textuelle :</strong> Requêtes d’organisation, messages, notes.</li>
                        <li><strong>Audio (microphone) :</strong> En mode chat vocal, le flux audio est transmis en temps réel pour transcription et réponse vocale.</li>
                        <li><strong>Visuel (caméra et photos) :</strong>
                            <ul>
                                <li>Analyse d’images (reconnaissance de texte, objets, etc.).</li>
                                <li>Chat vidéo (flux limité à 1 image/s pour interprétation visuelle).</li>
                            </ul>
                        </li>
                        <li><strong>Contexte personnel :</strong> Données d’agenda, de listes et de contacts pour offrir une assistance contextuelle.</li>
                    </ul>
                    <p>Ces données sont traitées exclusivement pour répondre à la demande de l’utilisateur et ne sont jamais utilisées à des fins d’entraînement du modèle ou d’analyse externe, sauf accord explicite.</p>

                    <h3>2. Rôles et Proactivité de l’Assistant IA</h3>
                    <p>L’utilisateur accepte que l’IA puisse effectuer des suggestions ou actions automatisées, notamment :</p>
                    <ul>
                        <li>Vérification d’agenda avant création d’événement ;</li>
                        <li>Détection de doublons ou de conflits ;</li>
                        <li>Suggestion de rattachement à un projet existant ;</li>
                        <li>Proposition de sous-tâches ou reformulation d’objectifs.</li>
                    </ul>
                    <p>Ces interventions n’ont aucune valeur juridique et nécessitent la validation explicite de l’utilisateur avant toute action effective.</p>

                    <h3>3. Responsabilité de l’Utilisateur</h3>
                    <p>L’IA est un outil d’assistance. L’utilisateur demeure seul responsable :</p>
                    <ul>
                        <li>du contenu qu’il crée, envoie ou publie via l’application,</li>
                        <li>de la vérification des informations générées,</li>
                        <li>et de toute décision prise sur la base des suggestions fournies.</li>
                    </ul>

                    <h2>III. Gestion des Données et Responsabilités Locales</h2>
                    <h3>1. Stockage Local et Synchronisation</h3>
                    <ul>
                        <li><strong>Mise en cache :</strong> Les données sont conservées localement pour un accès rapide.</li>
                        <li><strong>Sauvegarde asynchrone :</strong> Les modifications sont synchronisées avec Google Drive après un court délai (2,5 s).</li>
                        <li><strong>Gestion d’erreur :</strong> En cas de corruption, le cache est purgé et rechargé depuis Drive.</li>
                    </ul>
                    <p>Toutes les données locales sont stockées dans un format chiffré et non partagé.</p>

                    <h3>2. Historique et Annulation</h3>
                    <ul>
                        <li>Conservation des 30 dernières actions (ajout, modification, suppression).</li>
                        <li>Possibilité de restauration (“Annuler”).</li>
                        <li>Les 5 dernières versions d’une note sont conservées.</li>
                    </ul>

                    <h3>3. Suppression des Données et Projets</h3>
                    <ul>
                        <li>Les éléments supprimés passent par une zone dédiée avant effacement définitif.</li>
                        <li>Supprimer un projet ne supprime pas ses éléments associés (seule la liaison est retirée).</li>
                        <li>Une option de nettoyage complet est disponible pour purger toutes les données terminées.</li>
                    </ul>

                    <h2>IV. Utilisation des Outils d’Édition</h2>
                    <h3>1. Contenu de Texte Riche (HTML)</h3>
                    <p>Les éditeurs permettent la mise en forme (gras, italique, listes, tableaux, etc.). Le contenu est enregistré en HTML complet sous la responsabilité exclusive de l’utilisateur.</p>

                    <h3>2. Édition de Données Structurées</h3>
                    <ul>
                        <li><strong>Tâches :</strong> titre, priorité, description, date limite, sous-tâches.</li>
                        <li><strong>Articles de courses :</strong> nom, quantité, unité, magasin, description.</li>
                        <li><strong>Listes personnalisées :</strong> texte principal, description, champs personnalisés.</li>
                    </ul>
                    <p>L’utilisateur demeure responsable du contenu créé, importé ou modifié via ces outils.</p>
                    
                    <h2>V. Données Personnelles et Confidentialité</h2>
                    <p>Conformément au Règlement (UE) 2016/679 (RGPD), l’utilisateur dispose des droits suivants :</p>
                    <ul>
                        <li>Droit d’accès, de rectification, de suppression et de portabilité des données ;</li>
                        <li>Droit de limitation ou d’opposition à leur traitement ;</li>
                        <li>Droit de retirer son consentement à tout moment.</li>
                    </ul>
                    <p>Toute demande peut être adressée à : barnabe.hafner@gmail.com</p>
                    <p>Les données personnelles ne sont jamais vendues ni partagées avec des tiers, sauf lorsque nécessaire à l’exécution technique des fonctionnalités (Google API).</p>

                    <h2>VI. Propriété Intellectuelle et Contenu Généré</h2>
                    <ul>
                        <li>Le contenu créé ou importé par l’utilisateur demeure sa propriété exclusive.</li>
                        <li>L’éditeur n’en revendique aucun droit.</li>
                        <li>Le contenu généré par l’IA est fourni “tel quel”, sans garantie de fiabilité ou d’exactitude.</li>
                        <li>L’utilisateur est seul responsable de son usage et de sa diffusion.</li>
                    </ul>

                    <h2>VII. Limitation de Responsabilité</h2>
                    <p>L’éditeur ne saurait être tenu responsable :</p>
                    <ul>
                        <li>des erreurs ou conséquences d’un contenu généré par l’IA ;</li>
                        <li>des pertes de données imputables à des causes externes (connexion, API Google, appareil) ;</li>
                        <li>des dommages indirects liés à l’utilisation du service.</li>
                    </ul>

                    <h2>VIII. Résiliation et Suppression du Compte</h2>
                    <p>L’utilisateur peut à tout moment :</p>
                    <ul>
                        <li>résilier son compte,</li>
                        <li>supprimer toutes ses données synchronisées,</li>
                        <li>retirer les autorisations Google.</li>
                    </ul>
                    <p>La suppression entraîne la suppression définitive du fichier chiffré sur Google Drive et du cache local.</p>

                    <h2>IX. Modification des Conditions</h2>
                    <p>L’éditeur se réserve le droit de modifier les présentes Conditions d’Utilisation. L’utilisateur sera informé de toute mise à jour significative et devra accepter la nouvelle version avant de poursuivre l’utilisation du service.</p>

                    <h2>X. Droit Applicable et Litiges</h2>
                    <p>Les présentes conditions sont régies par le droit belge. Tout litige relatif à leur interprétation ou exécution relève de la compétence exclusive des tribunaux de Bruxelles.</p>
                </div>
            </div>
        </div>
    );
};

export default TermsOfUse;
