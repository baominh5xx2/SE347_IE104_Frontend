import { Component, ElementRef, EventEmitter, Output, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Message {
  content: string;
  isUser: boolean;
  timestamp: Date;
  isError?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

@Component({
  selector: 'app-admin-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-chatbot.component.html',
  styleUrls: ['./admin-chatbot.component.scss']
})
export class AdminChatbotComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInputRef!: ElementRef;

  messages: Message[] = [];
  userMessage = '';
  isStreaming = false;
  isTyping = false;
  conversationId: string | null = null;
  headerStatus = 'Online';
  conversations: Conversation[] = [];
  activeConversation: Conversation | null = null;
  isLoadingConversations = false;
  isLoadingMessages = false;
  isDeletingConversation: string | null = null;

  constructor(
    private router: Router
  ) {}

  ngOnInit(): void {
    // Load conversations from localStorage
    this.loadConversationsFromStorage();
    
    // Start with a new conversation if none exist
    if (!this.conversations.length) {
      this.startNewConversation();
    } else {
      // Load the most recent conversation
      this.selectConversation(this.conversations[0].id);
    }
  }

  ngOnDestroy(): void {
    // Save conversations before leaving
    this.saveConversationsToStorage();
  }

  onClose(): void {
    this.close.emit();
  }

  startNewConversation(): void {
    const newConversation: Conversation = {
      id: this.generateId(),
      title: 'Cuộc trò chuyện mới',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.conversations.unshift(newConversation);
    this.activeConversation = newConversation;
    this.conversationId = newConversation.id;
    this.messages = [];
    
    // Add welcome message
    this.addAssistantMessage('Xin chào Admin! Tôi có thể giúp gì cho bạn hôm nay?');
    this.saveConversationsToStorage();
  }

  selectConversation(conversationId: string): void {
    const conversation = this.conversations.find(c => c.id === conversationId);
    if (!conversation) return;

    this.activeConversation = conversation;
    this.conversationId = conversationId;
    
    // Load messages from localStorage
    const savedMessages = localStorage.getItem(`admin_chat_messages_${conversationId}`);
    if (savedMessages) {
      this.messages = JSON.parse(savedMessages).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    } else {
      this.messages = [];
      this.addAssistantMessage('Xin chào Admin! Tôi có thể giúp gì cho bạn?');
    }

    setTimeout(() => this.scrollToBottom(), 100);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    if (this.isDeletingConversation) return;

    this.isDeletingConversation = conversationId;
    
    // Remove from array
    this.conversations = this.conversations.filter(c => c.id !== conversationId);
    
    // Remove messages from storage
    localStorage.removeItem(`admin_chat_messages_${conversationId}`);
    
    // If deleting active conversation, switch to another
    if (this.activeConversation?.id === conversationId) {
      if (this.conversations.length > 0) {
        this.selectConversation(this.conversations[0].id);
      } else {
        this.startNewConversation();
      }
    }

    this.saveConversationsToStorage();
    this.isDeletingConversation = null;
  }

  async sendMessage(): Promise<void> {
    if (!this.userMessage.trim() || this.isStreaming) return;

    const messageText = this.userMessage.trim();
    this.userMessage = '';

    // Add user message
    this.addUserMessage(messageText);

    // Update conversation title if it's the first message
    if (this.activeConversation && this.messages.filter(m => m.isUser).length === 1) {
      this.activeConversation.title = messageText.substring(0, 50);
      this.saveConversationsToStorage();
    }

    // Show typing indicator
    this.isTyping = true;
    this.isStreaming = true;

    // Simulate AI response (TODO: Replace with actual API call)
    setTimeout(() => {
      this.isTyping = false;
      this.addAssistantMessage('Tính năng này đang được phát triển. Tôi sẽ sớm có thể trả lời câu hỏi của bạn!');
      this.isStreaming = false;
    }, 1500);
  }

  private addUserMessage(content: string): void {
    const message: Message = {
      content,
      isUser: true,
      timestamp: new Date()
    };
    this.messages.push(message);
    this.saveMessagesToStorage();
    setTimeout(() => this.scrollToBottom(), 100);
  }

  private addAssistantMessage(content: string, isError: boolean = false): void {
    const message: Message = {
      content,
      isUser: false,
      timestamp: new Date(),
      isError
    };
    this.messages.push(message);
    this.saveMessagesToStorage();
    setTimeout(() => this.scrollToBottom(), 100);
  }

  private scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      this.messagesContainer.nativeElement.scrollTop = 
        this.messagesContainer.nativeElement.scrollHeight;
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  getConversationPreview(conversation: Conversation): string {
    const messages = this.getMessagesForConversation(conversation.id);
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      return lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
    }
    return 'Không có tin nhắn';
  }

  private getMessagesForConversation(conversationId: string): Message[] {
    const savedMessages = localStorage.getItem(`admin_chat_messages_${conversationId}`);
    if (savedMessages) {
      return JSON.parse(savedMessages);
    }
    return [];
  }

  private loadConversationsFromStorage(): void {
    const saved = localStorage.getItem('admin_chat_conversations');
    if (saved) {
      this.conversations = JSON.parse(saved).map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt)
      }));
    }
  }

  private saveConversationsToStorage(): void {
    localStorage.setItem('admin_chat_conversations', JSON.stringify(this.conversations));
  }

  private saveMessagesToStorage(): void {
    if (this.conversationId) {
      localStorage.setItem(`admin_chat_messages_${this.conversationId}`, JSON.stringify(this.messages));
    }
  }

  formatMessageContent(content: string): string {
    // Basic formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
