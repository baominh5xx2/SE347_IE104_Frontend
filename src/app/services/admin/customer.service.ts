import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from '../config.service';

export interface Customer {
  user_id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  is_activate: boolean;
  role_id?: string;
  login_type: string;
  created_at: string;
  updated_at: string;
  total_bookings?: number;
  total_spent?: number;
  last_interaction?: string;
}

export interface ChatMessage {
  message_id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  entities?: any;
  created_at: string;
}

export interface ConversationHistory {
  conversation_id: string;
  user_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private get apiUrl(): string {
    return this.configService.getApiUrl();
  }

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  /**
   * Get conversation history by conversation_id
   */
  getConversationHistory(conversationId: string): Observable<ConversationHistory> {
    return this.http.get<ConversationHistory>(
      `${this.apiUrl}/chat/conversation/${conversationId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * Get all conversations for a specific user (mock - needs backend implementation)
   */
  getUserConversations(userId: string): Observable<ConversationHistory[]> {
    // TODO: Backend needs to implement this endpoint
    // For now, return mock data
    return new Observable(observer => {
      observer.next([]);
      observer.complete();
    });
  }

  /**
   * Delete a conversation
   */
  deleteConversation(conversationId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/chat/conversation/${conversationId}`,
      { headers: this.getHeaders() }
    );
  }
}
