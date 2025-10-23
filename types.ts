
export interface Language {
  code: string;
  name: string;
}

export enum MessageSender {
  USER = 'user',
  BOT = 'bot',
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
}
