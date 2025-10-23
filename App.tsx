
import React, { useState } from 'react';
import LanguageSelector from './components/LanguageSelector';
import ChatView from './components/ChatView';
import { type Language } from './types';

const App: React.FC = () => {
  const [nativeLanguage, setNativeLanguage] = useState<Language | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<Language | null>(null);
  const [isChatting, setIsChatting] = useState(false);

  const handleStartChat = (native: Language, target: Language) => {
    setNativeLanguage(native);
    setTargetLanguage(target);
    setIsChatting(true);
  };

  const handleEndChat = () => {
    setIsChatting(false);
    setNativeLanguage(null);
    setTargetLanguage(null);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Fluent Speaker AI
            </h1>
            <p className="text-gray-400 mt-2">Your personal AI-powered language tutor</p>
        </header>
        <main className="bg-gray-800 rounded-2xl shadow-2xl p-6 min-h-[60vh] flex flex-col">
            {!isChatting || !nativeLanguage || !targetLanguage ? (
              <LanguageSelector onStart={handleStartChat} />
            ) : (
              <ChatView
                nativeLanguage={nativeLanguage}
                targetLanguage={targetLanguage}
                onEndChat={handleEndChat}
              />
            )}
        </main>
      </div>
    </div>
  );
};

export default App;
