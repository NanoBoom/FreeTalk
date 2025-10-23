
import React, { useState } from 'react';
import { type Language } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';

interface LanguageSelectorProps {
  onStart: (native: Language, target: Language) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onStart }) => {
  const [nativeLang, setNativeLang] = useState<string>(SUPPORTED_LANGUAGES[0].code);
  const [targetLang, setTargetLang] = useState<string>(SUPPORTED_LANGUAGES[1].code);
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    if (nativeLang === targetLang) {
      setError('Native and target languages must be different.');
      return;
    }
    setError(null);
    const native = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang)!;
    const target = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)!;
    onStart(native, target);
  };
  
  const LanguageDropdown: React.FC<{
    id: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    label: string;
  }> = ({ id, value, onChange, label }) => (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
        <select
          id={id}
          value={value}
          onChange={onChange}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full p-2.5"
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>
      </div>
  );

  return (
    <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
        <h2 className="text-2xl font-semibold mb-6 text-gray-200">Set Up Your Learning Session</h2>
        <div className="w-full max-w-md space-y-6">
            <LanguageDropdown
              id="native-language"
              label="I speak..."
              value={nativeLang}
              onChange={e => setNativeLang(e.target.value)}
            />
            <LanguageDropdown
              id="target-language"
              label="I want to learn..."
              value={targetLang}
              onChange={e => setTargetLang(e.target.value)}
            />
             {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
        <button
            onClick={handleStart}
            className="mt-10 px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-full hover:scale-105 transform transition-transform duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-purple-300"
        >
            Start Learning
        </button>
    </div>
  );
};

export default LanguageSelector;
