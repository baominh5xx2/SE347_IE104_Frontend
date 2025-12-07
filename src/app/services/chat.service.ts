import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:8000/api/v1/chat/stream';

  constructor() { }

  async sendMessage(message: string, conversationId: string | null, userId: string | null, maxRecommendations: number = 5): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        conversation_id: conversationId,
        user_id: userId,
        max_recommendations: maxRecommendations
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body.getReader();
  }

  setApiUrl(url: string): void {
    this.apiUrl = url;
  }
}
