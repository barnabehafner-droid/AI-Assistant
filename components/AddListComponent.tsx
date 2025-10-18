import React, { useState, useRef, useEffect } from 'react';
import { PlusIcon, TrashIcon } from './icons';

interface AddListComponentProps {
    onAddList: (title: string, fields: { name: string }[]) => void;
}

const AddListComponent: React.FC<AddListComponentProps> = ({ onAddList }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [title, setTitle] = useState('');
    const [fields, setFields] = useState<{ name: string }[]>([{ name: '' }]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAdding) {
            inputRef.current?.focus();
        }
    }, [isAdding]);

    const handleFieldChange = (index: number, value: string) => {
        const newFields = [...fields];
        newFields[index].name = value;
        setFields(newFields);
    };

    const handleAddField = () => {
        setFields([...fields, { name: '' }]);
    };

    const handleRemoveField = (index: number) => {
        if (fields.length > 1) {
            const newFields = fields.filter((_, i) => i !== index);
            setFields(newFields);
        } else {
            // If it's the last one, just clear it
            setFields([{ name: '' }]);
        }
    };

    const handleCancel = () => {
        setIsAdding(false);
        setTitle('');
        setFields([{ name: '' }]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim()) {
            const validFields = fields.filter(f => f.name.trim() !== '');
            onAddList(title.trim(), validFields);
            handleCancel();
        }
    };

    if (isAdding) {
        return (
            <div className="bg-white rounded-xl shadow-md p-6 animate-fade-in">
                <form onSubmit={handleSubmit}>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">New List Title</h3>
                    <input
                        ref={inputRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Wine Collection"
                        className="w-full px-4 py-2 text-base bg-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none transition"
                        aria-label="New list title"
                    />

                    <h4 className="text-md font-bold text-slate-600 mt-6 mb-2">Custom Fields (Optional)</h4>
                    <div className="space-y-2">
                        {fields.map((field, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={field.name}
                                    onChange={(e) => handleFieldChange(index, e.target.value)}
                                    placeholder={`Field ${index + 1} (e.g., Region)`}
                                    className="flex-grow w-full px-4 py-2 text-base bg-slate-100 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveField(index)}
                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                    aria-label={`Remove field ${index + 1}`}
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    <button type="button" onClick={handleAddField} className="mt-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                        + Add another field
                    </button>

                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={handleCancel} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:bg-indigo-400" disabled={!title.trim()}>Create List</button>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <button
            onClick={() => setIsAdding(true)}
            className="bg-white/80 border-2 border-dashed border-slate-300 rounded-xl shadow-sm p-6 flex flex-col items-center justify-center min-h-[200px] hover:border-indigo-500 hover:text-indigo-600 transition-all duration-200 group"
        >
            <PlusIcon className="w-10 h-10 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <span className="mt-2 font-bold text-lg text-slate-500 group-hover:text-indigo-600">Add New List</span>
        </button>
    );
};

export default AddListComponent;