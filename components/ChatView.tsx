
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { type Language, type ChatMessage, MessageSender } from '../types';
import { getChatModel, getLiveModel, generateSpeech } from '../services/geminiService';
import { decode, encode, decodeAudioData } from '../utils/audio';
import { MicIcon, LoadingIcon, StopIcon } from './icons';
// FIX: Removed `LiveSession` from the import as it is not an exported member of `@google/genai`.
import { type Chat, type LiveServerMessage, type Blob, Modality } from '@google/genai';

interface ChatViewProps {
  nativeLanguage: Language;
  targetLanguage: Language;
  onEndChat: () => void;
}

// FIX: Inferred the live session promise type from the `getLiveModel` service because `LiveSession` is not an exported type.
type LiveSessionPromise = ReturnType<ReturnType<typeof getLiveModel>['connect']>;

const ChatView: React.FC<ChatViewProps> = ({ nativeLanguage, targetLanguage, onEndChat }) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState('');
  
  const chatRef = useRef<Chat | null>(null);
  const sessionPromiseRef = useRef<LiveSessionPromise | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const systemInstruction = `You are a friendly and patient language tutor. The user's native language is '${nativeLanguage.name}'. The user wants to learn and practice '${targetLanguage.name}'. Your rules are: 1. Always try to continue the conversation. 2. If the user speaks to you in '${targetLanguage.name}', you MUST respond ONLY in '${targetLanguage.name}'. 3. If the user speaks to you in their native language, '${nativeLanguage.name}', you MUST respond in '${nativeLanguage.name}'. In your response, gently remind them to try speaking in '${targetLanguage.name}' for practice. 4. Keep your responses concise and suitable for a language learner. 5. Start the conversation with a simple greeting in '${targetLanguage.name}'.`;
  
  const initializeChat = useCallback(async () => {
    setIsLoading(true);
    try {
      const chat = getChatModel();
      chatRef.current = chat;
      const response = await chat.sendMessage({
        message: 'Hello!',
        config: { systemInstruction }
      });
      const botMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: MessageSender.BOT,
        text: response.text,
      };
      setChatHistory([botMessage]);
      playAudio(response.text);
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      setChatHistory([{ id: 'error', sender: MessageSender.BOT, text: 'Sorry, I couldn\'t start our session. Please try again.'}]);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeLanguage, targetLanguage, systemInstruction]);
  
  useEffect(() => {
    initializeChat();
    return () => {
        // Cleanup function
        if(sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
        }
    }
  }, [initializeChat]);


  const playAudio = async (text: string) => {
    setIsPlaying(true);
    try {
        const base64Audio = await generateSpeech(text);
        if (!outputAudioContextRef.current) {
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const audioContext = outputAudioContextRef.current;
        const decodedBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(decodedBytes, audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
        source.onended = () => setIsPlaying(false);
    } catch (error) {
        console.error("Failed to play audio:", error);
        setIsPlaying(false);
    }
  };

  const handleMessage = (message: LiveServerMessage) => {
    if(message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      setCurrentTranscription(prev => prev + text);
    }
    if (message.serverContent?.turnComplete) {
      const finalTranscription = currentTranscription + (message.serverContent?.inputTranscription?.text || '');
      sendChatMessage(finalTranscription);
      setCurrentTranscription('');
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);
    setCurrentTranscription('');

    try {
      if (!mediaStreamRef.current) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      const liveService = getLiveModel();
      
      sessionPromiseRef.current = liveService.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            }
            const audioContext = audioContextRef.current;
            mediaStreamSourceRef.current = audioContext.createMediaStreamSource(mediaStreamRef.current!);
            scriptProcessorRef.current = audioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob: Blob = {
                  data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)),
                  mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContext.destination);
          },
          onmessage: handleMessage,
          onerror: (e: ErrorEvent) => console.error('Live session error:', e),
          onclose: (e: CloseEvent) => {},
        },
        config: {
          inputAudioTranscription: {},
          responseModalities: [Modality.AUDIO],
        }
      });

    } catch (err) {
      console.error('Error starting recording:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    sessionPromiseRef.current?.then(session => session.close());
    sessionPromiseRef.current = null;
    
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
  };
  
  const sendChatMessage = async (text: string) => {
      if (!text.trim() || !chatRef.current) return;
      
      const userMessage: ChatMessage = {
          id: Date.now().toString(),
          sender: MessageSender.USER,
          text,
      };
      setChatHistory(prev => [...prev, userMessage]);
      setIsLoading(true);

      try {
          const response = await chatRef.current.sendMessage({ message: text, config: { systemInstruction } });
          const botMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              sender: MessageSender.BOT,
              text: response.text,
          };
          setChatHistory(prev => [...prev, botMessage]);
          await playAudio(response.text);
      } catch (error) {
          console.error('Error sending message:', error);
          const errorMessage: ChatMessage = {
              id: (Date.now() + 1).toString(),
              sender: MessageSender.BOT,
              text: 'I had trouble understanding that. Could you try again?',
          };
          setChatHistory(prev => [...prev, errorMessage]);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm">
            <span className="text-gray-400">Practicing:</span> <span className="font-bold text-purple-300">{targetLanguage.name}</span>
        </div>
        <button onClick={onEndChat} className="text-sm text-gray-400 hover:text-white transition-colors"><StopIcon className="w-6 h-6"/></button>
      </div>

      <div ref={chatContainerRef} className="flex-grow overflow-y-auto mb-4 p-4 bg-gray-900 rounded-lg space-y-4">
        {chatHistory.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === MessageSender.USER ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl ${msg.sender === MessageSender.USER ? 'bg-purple-600 rounded-br-none' : 'bg-gray-700 rounded-bl-none'}`}>
              <p className="text-white">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && chatHistory.length > 0 && (
             <div className="flex items-end gap-2 justify-start">
                <div className="max-w-xs p-3 rounded-2xl bg-gray-700 rounded-bl-none">
                    <div className="flex items-center justify-center space-x-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                    </div>
                </div>
            </div>
        )}
        {currentTranscription && (
            <div className="flex items-end gap-2 justify-end">
                <div className="max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-2xl bg-purple-800 rounded-br-none opacity-60">
                    <p className="text-white italic">{currentTranscription}</p>
                </div>
            </div>
        )}
      </div>

      <div className="flex-shrink-0 flex flex-col items-center justify-center pt-4 border-t border-gray-700">
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={isLoading || isPlaying}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform focus:outline-none 
          ${isRecording ? 'bg-red-500 scale-110' : 'bg-purple-600 hover:bg-purple-700'} 
          ${(isLoading || isPlaying) ? 'cursor-not-allowed bg-gray-600' : ''}`}
        >
          {isLoading ? (
            <LoadingIcon className="w-10 h-10 text-white" />
          ) : (
            <MicIcon className="w-10 h-10 text-white" />
          )}
        </button>
        <p className="text-gray-400 text-sm mt-3">
          {isRecording ? "Listening..." : (isLoading || isPlaying ? "Thinking..." : "Hold to Speak")}
        </p>
      </div>
    </div>
  );
};

export default ChatView;