
import { Component, ElementRef, EventEmitter, Output, ViewChild, ChangeDetectorRef, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatService } from '../../services/chat.service';
import { TourService } from '../../services/tour.service';
import { Tour } from '../../shared/models/tour.model';
import { TourCardComponent } from '../tour-card/tour-card.component';
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
  mcpUiHtml?: string; // MCP UI HTML content (backward compatibility - deprecated)
  mcpUiResource?: { // MCP-UI standard UIResource object
    uri: string;
    mimeType?: string;
    text?: string;
  };
  tourPackages?: Tour[]; // Tour packages data for frontend component rendering
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
  imports: [CommonModule, FormsModule, TourCardComponent],
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
  private isUserNearBottom = true; // Track if user is near bottom (within 100px)
  private scrollDebounceTimer: any = null;

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
    
    // Setup scroll listener to detect user scroll position
    setTimeout(() => {
      this.setupScrollListener();
    }, 500);
  }

  private setupScrollListener(): void {
    if (!this.messagesContainer) return;
    
    const element = this.messagesContainer.nativeElement;
    element.addEventListener('scroll', () => {
      this.checkScrollPosition();
    }, { passive: true });
  }

  private checkScrollPosition(): void {
    if (!this.messagesContainer) return;
    
    const element = this.messagesContainer.nativeElement;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // User is "near bottom" if within 100px from bottom
    this.isUserNearBottom = distanceFromBottom <= 100;
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

  async sendMessage(): Promise<void> {
    if (this.isStreaming || !this.userMessage.trim()) return;

    const message = this.userMessage.trim();
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
    
    setTimeout(() => this.scrollToBottom(true), 100); // Force scroll when starting new message

    let lastAssistantMessage: Message | null = null; // Track last message for finally block
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
                    lastAssistantMessage = assistantMessage; // Track for finally block
                    
                    const tourSelections = this.extractTourSelections(this.currentStreamContent);
                    if (tourSelections.length > 0) {
                      assistantMessage.tourSelections = tourSelections;
                    }
                  }
                  this.touchConversation(conversation, false);
                  this.persistConversations();
                  // Use debounced scroll - only scroll if user is near bottom
                  this.debouncedScrollToBottom();
                  break;
                  
                case 'mcp_ui':
                  if (!assistantMessage) {
                    this.isTyping = false;
                    assistantMessage = { content: '', isUser: false };
                    this.messages.push(assistantMessage);
                    isFirstToken = false;
                  }
                  
                  if (assistantMessage) {
                    lastAssistantMessage = assistantMessage; // Track for finally block
                    // Priority: Use tourPackages data (new approach) if available
                    // BUT: Store in temporary property, will render after streaming completes
                    if (event.tourPackages && Array.isArray(event.tourPackages) && event.tourPackages.length > 0) {
                      // Map tour packages data but DON'T assign to tourPackages yet (wait for complete)
                      const mappedPackages = event.tourPackages.map((pkg: any) => {
                        // Keep image_urls as-is (pipe-separated) for gallery display
                        // Also set image_url for backward compatibility (featured image)
                        let image_url = pkg.image_url;
                        if (!image_url && pkg.image_urls) {
                          const urls = pkg.image_urls.split('|').filter((url: string) => url.trim());
                          if (urls.length > 0) {
                            // Reverse to get last image as featured (as per user requirement)
                            image_url = urls.reverse()[0].trim();
                          }
                        }
                        
                        return {
                          ...pkg,
                          image_url: image_url || pkg.image_url || 'img/tour-default.jpg',
                          image_urls: pkg.image_urls || pkg.image_url, // Keep image_urls for gallery
                          departure_location: pkg.departure_location || pkg.destination || ''
                        } as Tour;
                      });
                      
                      // Store in temporary property - will be assigned to tourPackages when streaming completes
                      (assistantMessage as any).pendingTourPackages = mappedPackages;
                      console.log(`✅ Received ${mappedPackages.length} tour packages (will render after streaming completes)`);
                    }
                    // Fallback: Keep HTML rendering for backward compatibility (render immediately)
                    else if (event.ui_resource) {
                      assistantMessage.mcpUiResource = event.ui_resource;
                      if (event.html || event.ui_resource.text) {
                        assistantMessage.mcpUiHtml = event.html || event.ui_resource.text;
                        // HTML can render immediately
                        this.cdr.detectChanges();
                        setTimeout(() => {
                          if (assistantMessage) {
                            this.setupMcpUiHandlers(assistantMessage);
                          }
                          this.debouncedScrollToBottom();
                        }, 0);
                      }
                    } else if (event.html) {
                      assistantMessage.mcpUiHtml = event.html;
                      // HTML can render immediately
                      this.cdr.detectChanges();
                      setTimeout(() => {
                        this.debouncedScrollToBottom();
                      }, 0);
                    }
                    
                    this.touchConversation(conversation, false);
                    this.persistConversations();
                  }
                  break;
                  
                case 'recommendations':
                  break;
                  
                case 'complete':
                case 'done':
                  // Streaming complete - now render tour cards if we have pending tour packages
                  if (assistantMessage && (assistantMessage as any).pendingTourPackages) {
                    assistantMessage.tourPackages = (assistantMessage as any).pendingTourPackages;
                    delete (assistantMessage as any).pendingTourPackages;
                    this.cdr.detectChanges();
                    // Force scroll to bottom when streaming completes (user expects to see new content)
                    setTimeout(() => {
                      this.scrollToBottom(true);
                    }, 0);
                  }
                  this.isStreaming = false;
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
      // Ensure tour cards are rendered if streaming ended without 'complete' event
      if (lastAssistantMessage && (lastAssistantMessage as any).pendingTourPackages) {
        lastAssistantMessage.tourPackages = (lastAssistantMessage as any).pendingTourPackages;
        delete (lastAssistantMessage as any).pendingTourPackages;
        this.cdr.detectChanges();
        // Force scroll to bottom when streaming ends
        setTimeout(() => {
          this.scrollToBottom(true);
        }, 0);
      }
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
    setTimeout(() => this.scrollToBottom(true), 100); // Force scroll when selecting conversation
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


  private scrollToBottom(force: boolean = false): void {
    // Only auto-scroll if user is near bottom OR force is true
    if (!force && !this.isUserNearBottom) {
      return; // User scrolled up, don't auto-scroll
    }
    
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
        // Update scroll position after scroll
        setTimeout(() => {
          this.checkScrollPosition();
        }, 0);
      });
    }
  }

  private debouncedScrollToBottom(force: boolean = false): void {
    // Debounce scroll to avoid too many calls during streaming
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }
    this.scrollDebounceTimer = setTimeout(() => {
      this.scrollToBottom(force);
    }, 100); // Debounce 100ms
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
