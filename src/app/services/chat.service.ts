import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:8000/api/v1/chat/stream';

  constructor() { }

  async sendMessage(message: string, conversationId: string | null, userId: string | null, maxRecommendations: number = 5): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    // Get token from localStorage
    const token = localStorage.getItem('access_token');
    
    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: headers,
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
