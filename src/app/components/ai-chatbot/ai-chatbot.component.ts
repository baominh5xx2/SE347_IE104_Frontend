
import { Component, ElementRef, EventEmitter, Output, ViewChild, ChangeDetectorRef, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatService } from '../../services/chat.service';
import { TourService } from '../../services/tour.service';
import { marked } from 'marked';

const STORAGE_KEY = 'ai.chatbot.conversations';

interface TourSelection {
  name: string;
  price: number;
  index: number;
}

interface Message {
  content: string;
  isUser: boolean;
  tourSelections?: TourSelection[];
  isError?: boolean;
  mcpUiHtml?: string; // MCP UI HTML content (backward compatibility)
  mcpUiResource?: { // MCP-UI standard UIResource object
    uri: string;
    mimeType?: string;
    text?: string;
  };
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  remoteConversationId: string | null;
  userId: string | null;
  messages: Message[];
}

@Component({
  selector: 'app-ai-chatbot',
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-chatbot.component.html',
  styleUrl: './ai-chatbot.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // Allow web components like ui-resource-renderer
})
export class AiChatbotComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInputRef!: ElementRef;

  messages: Message[] = [];
  userMessage = '';
  isStreaming = false;
  isTyping = false;
  conversationId: string | null = null;
  userId: string | null = null;
  headerStatus = 'Online';
  currentStreamContent = '';
  conversations: Conversation[] = [];
  activeConversation: Conversation | null = null;
  maxContextLength = 1000;
  contextLengthWarning: string | null = null;

  constructor(
    private chatService: ChatService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private tourService: TourService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadConversations();
    if (!this.conversations.length) {
      this.startNewConversation();
    } else {
      this.selectConversation(this.conversations[0].id);
    }
  }

  onClose(): void {
    const previousUrl = document.referrer;
    if (previousUrl && previousUrl.includes(window.location.origin)) {
      this.router.navigateByUrl('/home');
    } else {
      this.router.navigate(['/home']);
    }
    this.close.emit();
  }

  private getTotalContextLength(): number {
    return this.messages.reduce((total, msg) => {
      return total + (msg.content?.length || 0);
    }, 0);
  }

  private wouldExceedContextLimit(newMessageLength: number): boolean {
    const currentLength = this.getTotalContextLength();
    return (currentLength + newMessageLength) > this.maxContextLength;
  }

  getRemainingContextLength(): number {
    const currentLength = this.getTotalContextLength();
    return Math.max(0, this.maxContextLength - currentLength);
  }

  async sendMessage(): Promise<void> {
    if (this.isStreaming || !this.userMessage.trim()) return;

    const message = this.userMessage.trim();
    
    // Check if adding this message would exceed context limit
    if (this.wouldExceedContextLimit(message.length)) {
      const remaining = this.getRemainingContextLength();
      this.contextLengthWarning = `Bạn đã đạt giới hạn ${this.maxContextLength} ký tự. Vui lòng bắt đầu cuộc trò chuyện mới hoặc xóa một số tin nhắn cũ. (Còn lại: ${remaining} ký tự)`;
      setTimeout(() => {
        this.contextLengthWarning = null;
        this.cdr.detectChanges();
      }, 5000);
      this.cdr.detectChanges();
      return;
    }

    // Clear warning if message is valid
    this.contextLengthWarning = null;
    const conversation = this.ensureActiveConversation();

    this.messages.push({ content: message, isUser: true });
    this.userMessage = '';

    this.touchConversation(conversation);
    if (!conversation.messages.some(m => !m.isUser)) {
      conversation.title = this.generateConversationTitle(message);
    }
    this.persistConversations();
    
    if (this.messageInputRef && this.messageInputRef.nativeElement) {
      this.messageInputRef.nativeElement.style.height = 'auto';
    }
    
    this.isStreaming = true;
    this.isTyping = true;
    this.headerStatus = 'Thinking...';
    this.conversationId = conversation.remoteConversationId;
    this.userId = conversation.userId;
    
    setTimeout(() => this.scrollToBottom(), 100);

    try {
      const reader = await this.chatService.sendMessage(message, this.conversationId, this.userId, 5);
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessage: Message | null = null;
      let isFirstToken = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              
              switch (event.type) {
                case 'start':
                  this.conversationId = event.conversation_id;
                  this.userId = event.user_id;
                  conversation.remoteConversationId = event.conversation_id;
                  conversation.userId = event.user_id;
                  this.touchConversation(conversation);
                  this.persistConversations();
                  break;
                  
                case 'token':
                  if (isFirstToken) {
                    this.isTyping = false;
                    assistantMessage = { content: '', isUser: false };
                    this.messages.push(assistantMessage);
                    this.currentStreamContent = '';
                    isFirstToken = false;
                  }
                  if (assistantMessage) {
                    this.currentStreamContent += event.content;
                    assistantMessage.content = this.currentStreamContent;
                    
                    const tourSelections = this.extractTourSelections(this.currentStreamContent);
                    if (tourSelections.length > 0) {
                      assistantMessage.tourSelections = tourSelections;
                    }
                  }
                  this.touchConversation(conversation, false);
                  this.persistConversations();
                  setTimeout(() => this.scrollToBottom(), 0);
                  break;
                  
                case 'mcp_ui':
                  if (!assistantMessage) {
                    this.isTyping = false;
                    assistantMessage = { content: '', isUser: false };
                    this.messages.push(assistantMessage);
                    isFirstToken = false;
                  }
                  
                  if (assistantMessage) {
                    if (event.ui_resource) {
                      assistantMessage.mcpUiResource = event.ui_resource;
                      if (event.html || event.ui_resource.text) {
                        assistantMessage.mcpUiHtml = event.html || event.ui_resource.text;
                      }
                    } else if (event.html) {
                      assistantMessage.mcpUiHtml = event.html;
                    }
                    
                    this.cdr.detectChanges();
                    
                    setTimeout(() => {
                      this.cdr.detectChanges();
                      if (assistantMessage) {
                        this.setupMcpUiHandlers(assistantMessage);
                      }
                      this.scrollToBottom();
                    }, 0);
                    
                    setTimeout(() => {
                      this.cdr.detectChanges();
                      this.scrollToBottom();
                    }, 50);
                    
                    this.touchConversation(conversation, false);
                    this.persistConversations();
                  }
                  break;
                  
                case 'recommendations':
                  break;
                  
                case 'complete':
                  this.touchConversation(conversation);
                  this.persistConversations();
                  break;
                  
                case 'error':
                  if (isFirstToken) {
                    this.isTyping = false;
                    assistantMessage = { content: '', isUser: false };
                    this.messages.push(assistantMessage);
                    this.currentStreamContent = '';
                    isFirstToken = false;
                  }
                  if (assistantMessage) {
                    this.currentStreamContent += '\n\n[ERROR]: ' + event.content;
                    assistantMessage.content = this.currentStreamContent;
                  }
                  this.touchConversation(conversation);
                  this.persistConversations();
                  break;
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

      this.headerStatus = 'Online';
      this.touchConversation(conversation);
      this.persistConversations();
    } catch (error: any) {
      this.isTyping = false;
      let errorMessage = 'Unknown error occurred';
      
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to backend API. Please check:<br><br>' +
                      '1. Backend is running at http://localhost:8000<br>' +
                      '2. Backend has configured CORS<br>' +
                      '3. API URL is in correct format';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      this.messages.push({
        content: errorMessage,
        isUser: false,
        isError: true
      });
      const conversation = this.ensureActiveConversation();
      this.touchConversation(conversation);
      this.persistConversations();
      this.headerStatus = 'Error';
      console.error('Chat error:', error);
    } finally {
      this.isStreaming = false;
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onTextareaInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const currentInput = textarea.value;
    
    // Check if adding this input would exceed context limit
    const currentContextLength = this.getTotalContextLength();
    const totalWithInput = currentContextLength + currentInput.length;
    
    if (totalWithInput > this.maxContextLength) {
      // Prevent further input
      const maxAllowed = this.maxContextLength - currentContextLength;
      if (maxAllowed > 0) {
        textarea.value = currentInput.substring(0, maxAllowed);
        this.userMessage = textarea.value;
      } else {
        textarea.value = '';
        this.userMessage = '';
      }
      
      const remaining = this.getRemainingContextLength();
      this.contextLengthWarning = `Đã đạt giới hạn ${this.maxContextLength} ký tự.`;
      this.cdr.detectChanges();
    } else {
      // Clear warning if under limit
      this.contextLengthWarning = null;
    }
    
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  formatMessageContent(content: string): string {
    if (!content) return '';
    
    try {
      // Configure marked options
      // With breaks: false, double line breaks (\n\n) create paragraphs <p>
      // Single line breaks (\n) within paragraphs are ignored (standard markdown)
      marked.setOptions({
        breaks: false, // Use standard markdown: double line breaks = paragraphs
        gfm: true, // GitHub Flavored Markdown
      });
      
      // Pre-process content to ensure proper spacing
      // Normalize and ensure double line breaks for paragraphs
      let normalizedContent = content
        .replace(/\r\n/g, '\n') // Normalize Windows line breaks
        .replace(/\r/g, '\n') // Normalize Mac line breaks
        .replace(/\n{3,}/g, '\n\n') // Multiple line breaks become double
        .trim();
      
      // Render markdown to HTML
      // Marked will convert:
      // - Double line breaks (\n\n) → <p>paragraphs</p>
      // - Lists with proper spacing → <ul><li> or <ol><li>
      // - Bold/italic/code → proper HTML tags
      const html = marked.parse(normalizedContent);
      return html as string;
    } catch (error) {
      // Fallback: preserve line breaks as paragraphs
      const paragraphs = content
        .split(/\n\n+/) // Split on double or more line breaks
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
      return paragraphs || content.replace(/\n/g, '<br>');
    }
  }

  startNewConversation(): void {
    if (this.isStreaming) return;

    const conversation: Conversation = {
      id: this.generateId(),
      title: 'Cuộc trò chuyện mới',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      remoteConversationId: null,
      userId: null,
      messages: []
    };

    this.conversations = [conversation, ...this.conversations];
    this.selectConversation(conversation.id);
    this.persistConversations();
  }

  selectConversation(conversationId: string): void {
    if (this.isStreaming && this.activeConversation?.id !== conversationId) return;

    const conversation = this.conversations.find(conv => conv.id === conversationId);
    if (!conversation) return;

    this.activeConversation = conversation;
    this.messages = conversation.messages;
    this.conversationId = conversation.remoteConversationId;
    this.userId = conversation.userId;
    this.isTyping = false;
    this.isStreaming = false;
    this.currentStreamContent = '';
    setTimeout(() => this.scrollToBottom(), 100);
  }

  deleteConversation(conversationId: string): void {
    if (this.isStreaming) return;

    const index = this.conversations.findIndex(conv => conv.id === conversationId);
    if (index === -1) return;

    const wasActive = this.activeConversation?.id === conversationId;
    this.conversations.splice(index, 1);

    if (!this.conversations.length) {
      this.startNewConversation();
    } else if (wasActive) {
      const nextConversation = this.conversations[Math.min(index, this.conversations.length - 1)];
      this.selectConversation(nextConversation.id);
    }

    this.persistConversations();
  }

  formatTimestamp(timestamp: number): string {
    if (!timestamp) return '';
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      }).format(timestamp);
    } catch (error) {
      return new Date(timestamp).toLocaleString();
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (error) {
      return dateString;
    }
  }

  getConversationPreview(conversation: Conversation): string {
    if (!conversation.messages.length) {
      return 'Chưa có nội dung nào.';
    }
    const lastMessage = conversation.messages[conversation.messages.length - 1].content || '';
    const cleaned = lastMessage.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return 'Đang chờ nội dung từ trợ lý.';
    }
    return cleaned.length > 70 ? cleaned.slice(0, 67) + '…' : cleaned;
  }


  extractTourSelections(content: string): TourSelection[] {
    const patterns = [
      /<div class="list-item">.*?<strong>([^<]+)<\/strong>.*?(\d{1,3}(?:,\d{3})*)\s*VNĐ.*?<\/div>/gs,
      /<strong>([^<]+)<\/strong>.*?(\d{1,3}(?:,\d{3})*)\s*VNĐ/gs,
      /\*\*([^*]+)\*\*.*?(\d{1,3}(?:,\d{3})*)\s*VNĐ/gs
    ];
    
    const selections: TourSelection[] = [];
    
    for (const pattern of patterns) {
      const matches = [...content.matchAll(pattern)];
      if (matches.length > 0) {
        matches.forEach((match, index) => {
          const tourName = match[1].trim();
          const priceStr = match[2].replace(/,/g, '');
          const price = parseInt(priceStr);
          
          if (tourName && !isNaN(price)) {
            selections.push({
              name: tourName,
              price: price,
              index: index
            });
          }
        });
        break;
      }
    }
    
    return selections;
  }

  selectTour(tourName: string, price: string): void {
    this.userMessage = `Toi muon dat tour "${tourName}" voi gia ${this.formatPrice(parseInt(price.replace(/,/g, '')))}`;
    
    if (this.messageInputRef && this.messageInputRef.nativeElement) {
      const textarea = this.messageInputRef.nativeElement;
      textarea.focus();
      textarea.style.borderColor = 'var(--primary)';
      textarea.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
      
      setTimeout(() => {
        textarea.style.borderColor = '';
        textarea.style.boxShadow = '';
      }, 2000);
    }
  }

  async viewTourDetails(tourName: string): Promise<void> {
    try {
      const normalizedSearchName = tourName.toLowerCase().trim();
      let foundTour = null;
      
      // Tìm trong recommended tours trước
      try {
        const recommendedTours = await this.tourService.getRecommendedTours(100);
        foundTour = recommendedTours.find(tour => {
          const normalizedTourName = tour.package_name.toLowerCase().trim();
          return normalizedTourName === normalizedSearchName ||
                 normalizedTourName.includes(normalizedSearchName) ||
                 normalizedSearchName.includes(normalizedTourName);
        });
      } catch (error) {
        // Error loading recommended tours
      }
      
      if (!foundTour) {
        try {
          const allTours = await this.tourService.getTours();
          foundTour = allTours.find(tour => {
            const normalizedTourName = tour.package_name.toLowerCase().trim();
            return normalizedTourName === normalizedSearchName ||
                   normalizedTourName.includes(normalizedSearchName) ||
                   normalizedSearchName.includes(normalizedTourName);
          });
        } catch (error) {
          // Error loading tours
        }
      }

      if (foundTour && foundTour.package_id) {
        this.onClose();
        this.router.navigate(['/tour-details', foundTour.package_id]);
      } else {
        alert('Không tìm thấy tour này. Đang chuyển đến danh sách tour...');
        this.onClose();
        this.router.navigate(['/tours']);
      }
    } catch (error) {
      console.error('Error finding tour:', error);
      alert('Có lỗi xảy ra khi tìm tour. Đang chuyển đến danh sách tour...');
      this.onClose();
      this.router.navigate(['/tours']);
    }
  }

  navigateToTourDetail(tourId: string): void {
    if (!tourId) {
      alert('Không thể mở chi tiết tour. ID không hợp lệ.');
      return;
    }
    
    this.onClose();
    this.router.navigate(['/tour-details', tourId]);
  }


  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  private loadConversations(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as Conversation[];
      this.conversations = parsed.map(conversation => ({
        ...conversation,
        messages: conversation.messages || []
      }));
    } catch (error) {
      this.conversations = [];
    }
  }

  private persistConversations(): void {
    if (typeof window === 'undefined') return;
    try {
      const payload = JSON.stringify(this.conversations);
      localStorage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      // Failed to persist
    }
  }

  private ensureActiveConversation(): Conversation {
    if (!this.activeConversation) {
      this.startNewConversation();
    }
    return this.activeConversation!;
  }

  private generateConversationTitle(message: string): string {
    const cleaned = message.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return 'Cuộc trò chuyện mới';
    }
    return cleaned.length > 40 ? `${cleaned.slice(0, 37)}…` : cleaned;
  }

  private generateId(): string {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
    } catch (error) {
      // crypto.randomUUID unavailable, fallback to random string
    }
    return Math.random().toString(36).slice(2, 11);
  }

  private touchConversation(conversation: Conversation, bump: boolean = true): void {
    conversation.updatedAt = Date.now();
    if (!bump) {
      return;
    }

    const index = this.conversations.findIndex(conv => conv.id === conversation.id);
    if (index > 0) {
      this.conversations.splice(index, 1);
      this.conversations.unshift(conversation);
    }
  }

  setupMcpUiHandlers(message: Message): void {
    setTimeout(() => {
      (window as any).handleBooking = (packageId: string, packageName: string) => {
        this.userMessage = `Tôi muốn đặt tour "${packageName}" với ID ${packageId}`;
        this.sendMessage();
      };
      
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'tool') {
          const payload = event.data.payload;
          if (payload.toolName === 'create_booking') {
            const params = payload.params;
            this.userMessage = `Tôi muốn đặt tour "${params.package_name || 'tour'}" với ID ${params.package_id}`;
            this.sendMessage();
          }
        }
      });
    }, 200);
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getUiResourceJson(resource: any): string {
    const resourceObj = {
      uri: resource.uri || '',
      mimeType: resource.mimeType || 'text/html',
      text: resource.text || ''
    };
    return JSON.stringify(resourceObj);
  }

  initializeMcpUiRenderer(message: Message): void {
    if (message.mcpUiResource) {
      const index = this.messages.indexOf(message);
      const rendererId = `mcp-ui-${index}`;
      const renderer = document.getElementById(rendererId) as any;
      
      if (renderer) {
        try {
          const resourceJson = this.getUiResourceJson(message.mcpUiResource);
          renderer.setAttribute('resource', resourceJson);
          renderer.addEventListener('onUIAction', (event: any) => {
            this.handleMcpUIAction(event);
          });
        } catch (error) {
          const fallback = document.querySelector(`#mcp-ui-${index} + .mcp-ui-fallback`) as HTMLElement;
          if (fallback) {
            fallback.style.display = 'block';
          }
        }
      }
    }
  }

  handleMcpUIAction(event: any): void {
    if (event.detail) {
      const action = event.detail;
      if (action.type === 'mcp_ui_booking' || action.packageId) {
        const packageId = action.packageId || action.package_id;
        const packageName = action.packageName || action.package_name;
        if (packageId && packageName) {
          this.selectTour(packageName, '0');
        }
      }
    }
  }
}
