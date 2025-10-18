import React from 'react';
import { PlusIcon, LoaderIcon } from './icons';

interface InputBarProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  error: string | null;
  isChatting: boolean;
  isOnline: boolean;
}

const InputBar: React.FC<InputBarProps> = ({ value, onChange, onSubmit, isLoading, error, isChatting, isOnline }) => {
  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      <form onSubmit={onSubmit} className="relative w-full">
        <input
          type="text"
          value={value}
          onChange={onChange}
          disabled={isLoading || isChatting || !isOnline}
          placeholder={isOnline ? "e.g., Buy milk, eggs, and finish the report by Friday..." : "Mode hors ligne - Les actions IA sont désactivées."}
          className="w-full pl-6 pr-20 py-4 text-lg bg-white rounded-full shadow-lg focus:ring-4 focus:ring-indigo-300 focus:outline-none transition duration-300 ease-in-out disabled:bg-slate-200"
          aria-label="Add new items"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading || isChatting || !value.trim() || !isOnline}
              aria-label="Add items"
              className="h-14 w-14 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-300 transition-transform duration-200 ease-in-out active:scale-95 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isLoading ? <LoaderIcon className="w-6 h-6" /> : <PlusIcon className="w-7 h-7" />}
            </button>
        </div>
      </form>
      {error && <p className="text-red-500 text-center mt-2" role="alert">{error}</p>}
    </div>
  );
};

export default InputBar;