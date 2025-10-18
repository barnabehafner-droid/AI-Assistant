import { Priority, ShoppingUnit, TodoItem, TodoSortOrder } from '../../types';
import { filterListWithAI } from '../../services/geminiService';
import { ToolHandler, ToolHandlerContext } from './types';

export const createListHandlers = (context: ToolHandlerContext): Record<string, ToolHandler> => {
    const {
        organizer,
        setPendingDuplicate,
        triggerHighlight,
        setItemToOpenDetailsFor,
        findBestMatchingTodo,
        findBestMatchingNote,
        findBestMatchingShoppingItem,
        findBestMatchingSubtask,
        findBestMatchingList,
        findBestMatchingCustomListItem,
    } = context;

    const ajouterTache = (args: { task: string, priority?: Priority }): string => {
        const duplicate = organizer.findDuplicateForItem(args.task, 'todos');
        if (duplicate) {
            setPendingDuplicate({ type: 'todos', content: { task: args.task, priority: args.priority } });
            return `J'ai trouvé une tâche similaire : "${duplicate.text}". Voulez-vous l'ajouter quand même ?`;
        }
        const { newId, message } = organizer.addTodo(args.task, args.priority || Priority.Medium) || {};
        triggerHighlight(newId);
        return message || `OK, j'ai ajouté la tâche "${args.task}".`;
    };

    const ajouterArticleCourse = (args: { item: string }): string => {
        const duplicate = organizer.findDuplicateForItem(args.item, 'shopping');
        if (duplicate) {
            setPendingDuplicate({ type: 'shopping', content: { item: args.item } });
            return `J'ai trouvé un article similaire : "${duplicate.text}". Voulez-vous l'ajouter quand même ?`;
        }
        const { newId, message } = organizer.addShoppingItem(args.item) || {};
        triggerHighlight(newId);
        return message || `OK, j'ai ajouté "${args.item}" à la liste de courses.`;
    };

    const ajouterNote = (args: { content: string }): string => {
        const { newId, message } = organizer.addNote(args.content) || {};
        triggerHighlight(newId);
        return message || `OK, j'ai ajouté la note.`;
    };

    const basculerEtatTache = (args: { taskName: string }): string => {
        const todoToToggle = findBestMatchingTodo(args.taskName);
        if (todoToToggle) {
            const { message } = organizer.handleToggleTodo(todoToToggle.id) || {};
            triggerHighlight(todoToToggle.id);
            return message || "Action effectuée.";
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${args.taskName}".`;
    };

    const basculerEtatArticleCourse = (args: { itemName: string }): string => {
        const itemToToggle = findBestMatchingShoppingItem(args.itemName);
        if (itemToToggle) {
            const { message } = organizer.handleToggleShoppingItem(itemToToggle.id) || {};
            triggerHighlight(itemToToggle.id);
            return message || "Action effectuée.";
        }
        return `Désolé, je n'ai pas trouvé d'article ressemblant à "${args.itemName}" dans la liste de courses.`;
    };

    const creerListePersonnalisee = (args: { titre: string }): string => {
        const trimmedTitle = args.titre.trim();
        if (!trimmedTitle) {
            return "Veuillez fournir un nom pour la liste.";
        }
        if (organizer.customLists.some(list => list.title.toLowerCase() === trimmedTitle.toLowerCase())) {
            return `Désolé, une liste nommée "${trimmedTitle}" existe déjà.`;
        }
        const { message } = organizer.addCustomList(trimmedTitle, []) || {};
        context.restartNeededAfterTurnRef.current = true;
        return message || `OK, j'ai créé la nouvelle liste : "${trimmedTitle}".`;
    };

    const ajouterElementListePersonnalisee = (args: { nomListe: string, element: string }): string => {
        const list = findBestMatchingList(args.nomListe);
        if (!list) {
            return `Désolé, je n'ai pas trouvé de liste ressemblant à "${args.nomListe}".`;
        }
        const duplicate = organizer.findDuplicateForItem(args.element, 'custom', list.id);
        if (duplicate) {
            setPendingDuplicate({ type: 'custom', listId: list.id, content: { item: args.element } });
            return `J'ai trouvé un élément similaire : "${duplicate.text}". Voulez-vous l'ajouter quand même ?`;
        }
        const { newId, message } = organizer.addCustomListItem(list.id, args.element) || {};
        triggerHighlight(newId);
        return message || "Une erreur est survenue.";
    };

    const basculerEtatElementListePersonnalisee = (args: { nomListe: string, elementName: string }): string => {
        const listToUpdate = findBestMatchingList(args.nomListe);
        if (!listToUpdate) {
            return `Désolé, je n'ai pas trouvé de liste ressemblant à "${args.nomListe}".`;
        }
        const itemToToggle = findBestMatchingCustomListItem(listToUpdate, args.elementName);
        if (itemToToggle) {
            const { message } = organizer.toggleCustomListItem(listToUpdate.id, itemToToggle.id) || {};
            triggerHighlight(itemToToggle.id);
            return message || "Action effectuée.";
        }
        return `Désolé, je n'ai pas trouvé d'élément ressemblant à "${args.elementName}" dans la liste "${listToUpdate.title}".`;
    };

    const supprimerTache = (args: { taskName: string }): string => {
        const todoToDelete = findBestMatchingTodo(args.taskName);
        if (todoToDelete) {
            const { message } = organizer.handleDeleteTodo(todoToDelete.id) || {};
            return message || "Tâche supprimée.";
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${args.taskName}".`;
    };

    const supprimerArticleCourse = (args: { itemName: string }): string => {
        const itemToDelete = findBestMatchingShoppingItem(args.itemName);
        if (itemToDelete) {
            const { message } = organizer.handleDeleteShoppingItem(itemToDelete.id) || {};
            return message || "Article supprimé.";
        }
        return `Désolé, je n'ai pas trouvé d'article ressemblant à "${args.itemName}".`;
    };
    
    const supprimerNote = (args: { contentQuery: string }): string => {
        const noteToDelete = findBestMatchingNote(args.contentQuery);
        if (noteToDelete) {
            const { message } = organizer.handleDeleteNote(noteToDelete.id) || {};
            return message || "Note supprimée.";
        }
        return `Désolé, je n'ai pas trouvé de note contenant "${args.contentQuery}".`;
    };

    const supprimerElementListePersonnalisee = (args: { nomListe: string, elementName: string }): string => {
        const listToUpdate = findBestMatchingList(args.nomListe);
        if (!listToUpdate) return `Désolé, je n'ai pas trouvé de liste ressemblant à "${args.nomListe}".`;
        const itemToDelete = findBestMatchingCustomListItem(listToUpdate, args.elementName);
        if (itemToDelete) {
            const { message } = organizer.deleteCustomListItem(listToUpdate.id, itemToDelete.id) || {};
            return message || "Élément supprimé.";
        }
        return `Désolé, je n'ai pas trouvé d'élément ressemblant à "${args.elementName}" dans la liste "${listToUpdate.title}".`;
    };

    const modifierTache = (args: { oldTaskName: string, newTaskName: string }): string => {
        const todoToEdit = findBestMatchingTodo(args.oldTaskName);
        if (todoToEdit) {
            const { message } = organizer.editTodo(todoToEdit.id, args.newTaskName) || {};
            triggerHighlight(todoToEdit.id);
            return message || "Tâche modifiée.";
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${args.oldTaskName}".`;
    };

    const modifierPrioriteTache = (args: { taskName: string, newPriority: Priority }): string => {
        const todoToEdit = findBestMatchingTodo(args.taskName);
        if (todoToEdit) {
            const { message } = organizer.editTodoPriority(todoToEdit.id, args.newPriority) || {};
            triggerHighlight(todoToEdit.id);
            return message || "Priorité modifiée.";
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${args.taskName}".`;
    };
    
    const modifierArticleCourse = (args: { oldItemName: string, newItemName: string }): string => {
        const itemToEdit = findBestMatchingShoppingItem(args.oldItemName);
        if (itemToEdit) {
            const { message } = organizer.editShoppingItem(itemToEdit.id, args.newItemName) || {};
            triggerHighlight(itemToEdit.id);
            return message || "Article modifié.";
        }
        return `Désolé, je n'ai pas trouvé d'article ressemblant à "${args.oldItemName}".`;
    };

    const modifierNote = (args: { noteIdentifier: string, nouveauContenu: string }): string => {
        const noteToEdit = findBestMatchingNote(args.noteIdentifier);
        if (noteToEdit) {
            organizer.editNote(noteToEdit.id, args.nouveauContenu);
            triggerHighlight(noteToEdit.id);
            return `OK, j'ai mis à jour la note.`;
        }
        return `Désolé, je n'ai pas trouvé de note correspondant à "${args.noteIdentifier}".`;
    };

    const modifierElementListePersonnalisee = (args: { nomListe: string, oldElementName: string, newElementName: string }): string => {
        const listToUpdate = findBestMatchingList(args.nomListe);
        if (!listToUpdate) return `Désolé, je n'ai pas trouvé de liste ressemblant à "${args.nomListe}".`;
        const itemToEdit = findBestMatchingCustomListItem(listToUpdate, args.oldElementName);
        if (itemToEdit) {
            const { message } = organizer.editCustomListItemDetails(listToUpdate.id, itemToEdit.id, { text: args.newElementName }) || {};
            triggerHighlight(itemToEdit.id);
            return message || "Élément modifié.";
        }
        return `Désolé, je n'ai pas trouvé d'élément ressemblant à "${args.oldElementName}" dans la liste "${listToUpdate.title}".`;
    };

    const deplacerElement = (args: { elementName: string, sourceListName: string, destListName: string }): string => {
        const moveResult = organizer.moveItemByNameAndList(args.elementName, args.sourceListName, args.destListName);
        if (moveResult.success) {
            triggerHighlight(moveResult.itemId);
        }
        return moveResult.message;
    };

    const afficherDetailsTache = (args: { taskName: string }): string => {
        const todoToShow = findBestMatchingTodo(args.taskName);
        if (todoToShow) {
            setItemToOpenDetailsFor({ type: 'todos', id: todoToShow.id });
            return `OK, j'affiche les détails de la tâche "${todoToShow.task}".`;
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${args.taskName}".`;
    };

    const afficherDetailsNote = (args: { contentQuery: string }): string => {
        const noteToShow = findBestMatchingNote(args.contentQuery);
        if (noteToShow) {
            setItemToOpenDetailsFor({ type: 'notes', id: noteToShow.id });
            return `OK, j'affiche la note qui commence par "${noteToShow.content.slice(0, 30)}...".`;
        }
        return `Désolé, je n'ai pas trouvé de note contenant "${args.contentQuery}".`;
    };
    
    const afficherDetailsArticleCourse = (args: { itemName: string }): string => {
        const itemToShow = findBestMatchingShoppingItem(args.itemName);
        if (itemToShow) {
            setItemToOpenDetailsFor({ type: 'shopping', id: itemToShow.id });
            return `OK, j'affiche les détails pour "${itemToShow.item}".`;
        }
        return `Désolé, je n'ai pas trouvé d'article ressemblant à "${args.itemName}".`;
    };
    
    const afficherDetailsElementListePersonnalisee = (args: { nomListe: string, elementName: string }): string => {
        const list = findBestMatchingList(args.nomListe);
        if (!list) return `Désolé, je n'ai pas trouvé de liste ressemblant à "${args.nomListe}".`;
        const item = findBestMatchingCustomListItem(list, args.elementName);
        if (item) {
            setItemToOpenDetailsFor({ type: 'custom', id: item.id, listId: list.id });
            return `OK, j'affiche les détails de "${item.text}" dans la liste "${list.title}".`;
        }
        return `Désolé, je n'ai pas trouvé d'élément ressemblant à "${args.elementName}" dans la liste "${list.title}".`;
    };

    const ajouterDetailsArticleCourse = (args: { itemName: string, quantity?: number, unit?: ShoppingUnit, store?: string, description?: string }): string => {
        const itemToUpdate = findBestMatchingShoppingItem(args.itemName);
        if (itemToUpdate) {
            const { message } = organizer.editShoppingItemDetails(itemToUpdate.id, args) || {};
            triggerHighlight(itemToUpdate.id);
            return message || "Détails mis à jour.";
        }
        return `Désolé, je n'ai pas trouvé d'article ressemblant à "${args.itemName}".`;
    };

    const ajouterDescriptionTache = (args: { taskName: string, description: string }): string => {
        const todoToUpdate = findBestMatchingTodo(args.taskName);
        if (todoToUpdate) {
            const { message } = organizer.editTodoDescription(todoToUpdate.id, args.description) || {};
            triggerHighlight(todoToUpdate.id);
            return message || "Description ajoutée.";
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${args.taskName}".`;
    };
    
    const ajouterDescriptionElementListePersonnalisee = (args: { nomListe: string, elementName: string, description: string }): string => {
        const list = findBestMatchingList(args.nomListe);
        if (!list) return `Désolé, je n'ai pas trouvé de liste ressemblant à "${args.nomListe}".`;
        const item = findBestMatchingCustomListItem(list, args.elementName);
        if (item) {
            const { message } = organizer.editCustomListItemDetails(list.id, item.id, { description: args.description }) || {};
            triggerHighlight(item.id);
            return message || "Description ajoutée.";
        }
        return `Désolé, je n'ai pas trouvé d'élément ressemblant à "${args.elementName}" dans la liste "${list.title}".`;
    };

    const ajouterSousTache = (args: { taskName: string, subtaskText: string }): string => {
        const todoToUpdate = findBestMatchingTodo(args.taskName);
        if (todoToUpdate) {
            const { message } = organizer.addTodoSubtask(todoToUpdate.id, args.subtaskText) || {};
            triggerHighlight(todoToUpdate.id);
            return message || "Sous-tâche ajoutée.";
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${args.taskName}".`;
    };
    
    const basculerEtatSousTache = (args: { taskName: string, subtaskName: string }): string => {
        const todoToUpdate = findBestMatchingTodo(args.taskName);
        if (!todoToUpdate) return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${args.taskName}".`;
        const subtaskToToggle = findBestMatchingSubtask(args.subtaskName, todoToUpdate.subtasks);
        if (subtaskToToggle) {
            const { message } = organizer.toggleTodoSubtask(todoToUpdate.id, subtaskToToggle.id) || {};
            triggerHighlight(todoToUpdate.id);
            return message || "Sous-tâche mise à jour.";
        }
        return `Désolé, je n'ai pas trouvé de sous-tâche ressemblant à "${args.subtaskName}" dans "${todoToUpdate.task}".`;
    };

    const definirDateLimiteTache = (args: { taskName: string, dueDate: string }): string => {
        const todoToUpdate = findBestMatchingTodo(args.taskName);
        if (todoToUpdate) {
            const { message } = organizer.editTodoDueDate(todoToUpdate.id, args.dueDate) || {};
            triggerHighlight(todoToUpdate.id);
            return message || "Date limite définie.";
        }
        return `Désolé, je n'ai pas trouvé de tâche ressemblant à "${args.taskName}".`;
    };

    const trierTaches = (args: { critere: 'priorité' | 'date' | 'alphabétique' }): string => {
        const sortOrderMapping: { [key in typeof args.critere]: TodoSortOrder } = { 'priorité': 'priority', 'date': 'dueDate', 'alphabétique': 'alphabetical' };
        const sortOrder = sortOrderMapping[args.critere];
        if (sortOrder) {
            const { message } = organizer.setTodoSortOrder(sortOrder) || {};
            return message || `OK, je trie les tâches par ${args.critere}.`;
        }
        return `Désolé, je ne peux pas trier par "${args.critere}".`;
    };
    
    const supprimerElementsCoches = (args: { nomListe: string }): string => {
        const lowerListName = args.nomListe.toLowerCase();
        if (['tâches', 'todo'].some(a => lowerListName.includes(a))) return organizer.deleteCompletedTodos()?.message || "";
        if (['courses', 'shopping'].some(a => lowerListName.includes(a))) return organizer.deleteCompletedShoppingItems()?.message || "";
        const list = findBestMatchingList(args.nomListe);
        if (list) return organizer.deleteCompletedCustomListItems(list.id)?.message || "";
        return `Désolé, je n'ai pas trouvé de liste nommée "${args.nomListe}".`;
    };

    const filtrerListe = async (args: { nomListe: string, critereFiltre: string }): Promise<string> => {
        const { todos, shoppingList, customLists } = organizer;
        const lowerListName = args.nomListe.toLowerCase();
        const lowerCriteria = args.critereFiltre.toLowerCase();
        let matchingIds: string[] = [];
        let targetList: any[] = [];
        let listType: any = null;
        let listId: string | undefined = undefined;
        let itemTextProp = 'task';

        if (['tâches', 'todo'].some(a => lowerListName.includes(a))) { listType = 'todos'; targetList = todos; } 
        else if (['courses', 'shopping'].some(a => lowerListName.includes(a))) { listType = 'shopping'; targetList = shoppingList; itemTextProp = 'item'; } 
        else {
            const list = findBestMatchingList(args.nomListe);
            if (list) { listType = 'custom'; listId = list.id; targetList = list.items; itemTextProp = 'text'; } 
            else { return `Désolé, je n'ai pas trouvé de liste nommée "${args.nomListe}".`; }
        }

        const priorityMatch = lowerCriteria.match(/priorité (haute|élevée|moyenne|basse|high|medium|low)/);
        if (listType === 'todos' && priorityMatch) {
            const priorityMap: any = { haute: 'high', élevée: 'high', moyenne: 'medium', basse: 'low' };
            matchingIds = (targetList as TodoItem[]).filter(item => item.priority === priorityMap[priorityMatch[1]]).map(item => item.id);
        } else {
            const itemsToFilter = targetList.map(item => ({ id: item.id, text: item[itemTextProp] }));
            matchingIds = await filterListWithAI(itemsToFilter, args.critereFiltre);
        }

        organizer.setActiveFilter({ listType, listId, criteria: args.critereFiltre, itemIds: new Set(matchingIds) });
        return `OK, je filtre la liste "${args.nomListe}".`;
    };

    const annulerFiltre = (): string => {
        organizer.clearFilter();
        return "OK, j'ai annulé le filtre.";
    };


    return {
        ajouterTache,
        ajouterArticleCourse,
        ajouterNote,
        basculerEtatTache,
        basculerEtatArticleCourse,
        creerListePersonnalisee,
        ajouterElementListePersonnalisee,
        basculerEtatElementListePersonnalisee,
        supprimerTache,
        supprimerArticleCourse,
        supprimerNote,
        supprimerElementListePersonnalisee,
        modifierTache,
        modifierPrioriteTache,
        modifierArticleCourse,
        modifierNote,
        modifierElementListePersonnalisee,
        deplacerElement,
        afficherDetailsTache,
        afficherDetailsNote,
        afficherDetailsArticleCourse,
        afficherDetailsElementListePersonnalisee,
        ajouterDetailsArticleCourse,
        ajouterDescriptionTache,
        ajouterDescriptionElementListePersonnalisee,
        ajouterSousTache,
        basculerEtatSousTache,
        definirDateLimiteTache,
        trierTaches,
        supprimerElementsCoches,
        filtrerListe,
        annulerFiltre
    };
};
