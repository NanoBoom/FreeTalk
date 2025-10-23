
import { GoogleGenAI, Modality } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getChatModel = () => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
  });
};

export const getLiveModel = () => {
    return ai.live;
}

export const generateSpeech = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    }
    throw new Error("No audio data received from TTS API");
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
};
