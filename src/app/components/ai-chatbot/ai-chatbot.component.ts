import { Component, ElementRef, EventEmitter, Output, ViewChild, ChangeDetectorRef, OnInit, OnDestroy, SecurityContext, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatService } from '../../services/chat.service';
import { ChatRoomService } from '../../services/chat-room.service';
import { TourService } from '../../services/tour.service';
import { AuthStateService } from '../../services/auth-state.service';
import { TourCardComponent } from '../tour-card/tour-card.component';
import { Tour } from '../../shared/models/tour.model';

interface TourSelection {
  name: string;
  price: number;
  index: number;
}

interface McpUiResource {
  text?: string;
  [key: string]: any;
}

interface Message {
  content: string;
  isUser: boolean;
  tours?: any[];
  tourSelections?: TourSelection[];
  isError?: boolean;
  tourPackages?: Tour[];
  mcpUiResource?: McpUiResource;
  mcpUiHtml?: string;
  showTourCards?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  remoteConversationId: string | null;
  userId: string | null;
}

@Component({
  selector: 'app-ai-chatbot',
  imports: [CommonModule, FormsModule, TourCardComponent],
  templateUrl: './ai-chatbot.component.html',
  styleUrl: './ai-chatbot.component.scss'
})
export class AiChatbotComponent implements OnInit, OnDestroy {
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
  // Cache and loading states
  private messagesCache = new Map<string, Message[]>();
  private readonly conversationsCacheKey = 'ai.chatbot.conversations.cache';
  private readonly conversationsCacheTTL = 5 * 60 * 1000; // 5 phút
  isDeletingConversation: string | null = null;
  isLoadingConversations = false;
  isLoadingMessages = false;
  userHasScrolledUp: boolean = false;
  isProcessingPayment: boolean = false;

  constructor(
    private chatService: ChatService,
    private chatRoomService: ChatRoomService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private tourService: TourService,
    private authStateService: AuthStateService,
    private sanitizer: DomSanitizer
  ) {}

  private paymentButtonClickHandler = (event: MessageEvent) => {
    if (event.data && event.data.type === 'mcp_ui_payment') {
      const paymentUrl = event.data.payment_url;
      const bookingId = event.data.booking_id;
      console.log('Payment button clicked:', { paymentUrl, bookingId });
      
      if (paymentUrl) {
        window.location.href = paymentUrl;
      }
    }
  };

  ngOnInit(): void {
    // Check nếu có payment_return_url trong sessionStorage (sau khi thanh toán xong)
    const returnUrl = sessionStorage.getItem('payment_return_url');
    if (returnUrl && returnUrl.includes('/chat-room/')) {
      // Clear sessionStorage và redirect về chat room
      sessionStorage.removeItem('payment_return_url');
      // Đảm bảo đang ở đúng chat room
      const currentUrl = window.location.href;
      if (!currentUrl.includes('/chat-room/')) {
        this.router.navigateByUrl(returnUrl);
        return;
      }
    }
    
    // Listen for payment button clicks from dynamically rendered HTML
    window.addEventListener('message', this.paymentButtonClickHandler);
    
    // Also listen for custom events
    window.addEventListener('mcpPayment', ((event: CustomEvent) => {
      const paymentUrl = event.detail?.payment_url;
      if (paymentUrl) {
        // Lưu chat room URL vào sessionStorage để redirect về sau khi thanh toán
        const currentUrl = window.location.href;
        sessionStorage.setItem('payment_return_url', currentUrl);
        // KHÔNG modify payment URL - giữ nguyên như backend generate
        window.location.href = paymentUrl;
      }
    }) as EventListener);
    if (!this.authStateService.getIsAuthenticated()) {
      this.onClose();
      this.router.navigate(['/login']);
      return;
    }

    // Clear conversations và load từ API
    this.conversations = [];
    this.messages = [];
    
    const urlRoomId = this.route.snapshot.paramMap.get('roomId');
    
    // Check query param payment_success để hiển thị message chúc mừng
    const paymentSuccess = this.route.snapshot.queryParamMap.get('payment_success');
    
    // Load conversations list trước, sau đó mới quyết định tạo mới hay load conversation cũ
    this.loadConversationsList(async () => {
      if (urlRoomId) {
        await this.loadRoomFromUrl(urlRoomId);
        // Sau khi load room, check payment_success và thêm message chúc mừng
        if (paymentSuccess === 'true') {
          setTimeout(() => {
            this.addPaymentSuccessMessage();
            // Remove query param để không hiển thị lại khi refresh
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: {},
              replaceUrl: true
            });
          }, 500);
        }
        return;
      }

      // Fallback: chọn conversation đầu tiên hoặc tạo mới
      if (this.conversations.length > 0) {
        const firstConversation = this.conversations[0];
        this.selectConversation(firstConversation.id);
        // Sau khi select conversation, check payment_success và thêm message chúc mừng
        if (paymentSuccess === 'true') {
          setTimeout(() => {
            this.addPaymentSuccessMessage();
            // Remove query param để không hiển thị lại khi refresh
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: {},
              replaceUrl: true
            });
          }, 500);
        }
      } else {
        this.startNewConversation();
        // Sau khi tạo conversation mới, check payment_success và thêm message chúc mừng
        if (paymentSuccess === 'true') {
          setTimeout(() => {
            this.addPaymentSuccessMessage();
            // Remove query param để không hiển thị lại khi refresh
            this.router.navigate([], {
              relativeTo: this.route,
              queryParams: {},
              replaceUrl: true
            });
          }, 500);
        }
      }
    });
  }

  onClose(): void {
    this.router.navigate(['/home']);
  }

  async sendMessage(): Promise<void> {
    if (!this.authStateService.getIsAuthenticated()) {
      this.onClose();
      this.router.navigate(['/login']);
      return;
    }

    if (this.isStreaming || !this.userMessage.trim()) return;

    const message = this.userMessage.trim();
    const conversation = this.ensureActiveConversation();

    // Nếu conversation chưa có room (chưa gửi message nào), tạo room trước
    if (!conversation.remoteConversationId) {
      await this.createRoomForConversation(conversation);
    }

    if (conversation.remoteConversationId) {
      this.messagesCache.delete(conversation.remoteConversationId);
    }

    // Thêm user message vào UI
    const userMessageObj: Message = { content: message, isUser: true };
    this.messages.push(userMessageObj);
    this.userMessage = '';
    this.userHasScrolledUp = false; // Reset scroll state khi user gửi message mới

    this.touchConversation(conversation);
    if (!this.messages.some(m => !m.isUser)) {
      conversation.title = this.generateConversationTitle(message);
    }
    
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
                  console.log('Conversation started:', this.conversationId);
                  if (this.conversationId) {
                    this.router.navigate(['/chat-room', this.conversationId], { replaceUrl: true });
                  }
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
                  setTimeout(() => this.scrollToBottom(), 0);
                  break;
                  
                case 'recommendations':
                  console.log('Recommendations received:', event.data);
                  if (assistantMessage && event.data) {
                    assistantMessage.tourPackages = event.data;
                    assistantMessage.tours = event.data;
                    assistantMessage.showTourCards = true;
                    console.log('Tours assigned to message:', assistantMessage.tourPackages);
                    if (assistantMessage.tourPackages && assistantMessage.tourPackages.length > 0) {
                      console.log('First tour data:', JSON.stringify(assistantMessage.tourPackages[0], null, 2));
                      console.log('Tour fields:', Object.keys(assistantMessage.tourPackages[0]));
                    }
                    this.cdr.detectChanges();
                    this.touchConversation(conversation, false);
                  }
                  setTimeout(() => this.scrollToBottom(), 100);
                  break;
                  
                case 'mcp_ui':
                  console.log('MCP UI received:', event);
                  if (assistantMessage) {
                    if (event.ui_resource) {
                      assistantMessage.mcpUiResource = event.ui_resource;
                    }
                    if (event.html) {
                      assistantMessage.mcpUiHtml = event.html;
                    }
                    if (event.tourPackages) {
                      assistantMessage.tourPackages = event.tourPackages;
                      assistantMessage.showTourCards = true;
                    }
                    this.cdr.detectChanges();
                    this.touchConversation(conversation, false);
                    
                    // Attach payment button click handlers after HTML is rendered (gọi nhiều lần để đảm bảo attach được)
                    setTimeout(() => {
                      this.attachPaymentButtonHandlers();
                    }, 50);
                    setTimeout(() => {
                      this.attachPaymentButtonHandlers();
                    }, 200);
                    setTimeout(() => {
                      this.attachPaymentButtonHandlers();
                    }, 500);
                  }
                  setTimeout(() => this.scrollToBottom(), 100);
                  break;
                  
                case 'complete':
                  console.log('Complete:', event.full_response);
                  this.touchConversation(conversation);
                  break;
                  
                case 'error':
                  if (isFirstToken) {
                    this.isTyping = false;
                    assistantMessage = { content: '', isUser: false, isError: true };
                    this.messages.push(assistantMessage);
                    this.currentStreamContent = '';
                    isFirstToken = false;
                  }
                  if (assistantMessage) {
                    this.currentStreamContent += '\n\n[ERROR]: ' + event.content;
                    assistantMessage.content = this.currentStreamContent;
                    assistantMessage.isError = true;
                  }
                  this.touchConversation(conversation);
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
    } catch (error: any) {
      this.isTyping = false;
      let errorMessage = 'Unknown error occurred';
      
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to backend API. Please check:<br><br>' +
                      '1. Backend is running<br>' +
                      '2. Backend has configured CORS<br>' +
                      '3. API URL is configured correctly in config.json';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      const errorMsg: Message = {
        content: errorMessage,
        isUser: false,
        isError: true
      };
      this.messages.push(errorMsg);
      const conversation = this.ensureActiveConversation();
      this.touchConversation(conversation);
      this.headerStatus = 'Error';
      console.error('Chat error:', error);
    } finally {
      this.isStreaming = false;
      const activeRoomId = this.activeConversation?.remoteConversationId;
      if (activeRoomId) {
        this.messagesCache.set(activeRoomId, [...this.messages]);
      }
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
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  formatMessageContent(content: string): string {
    if (!content) return '';
    const normalized = content.replace(/[—–]/g, ' - ');
    
    let html = this.parseMarkdown(normalized);
    // Convert URLs to clickable square buttons inside the bubble
    html = html.replace(/(https?:\/\/[^\s<]+)/gim, (url) => {
      return `<a class="source-button" href="${url}" target="_blank" rel="noopener noreferrer" title="${url}"><span>Nguồn</span></a>`;
    });
    
    return html;
  }
  
  private truncateUrl(url: string, maxLength: number): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }
  
  private getDomainFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'Nguồn';
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
      userId: null
    };

    this.conversations = [conversation, ...this.conversations];
    this.selectConversation(conversation.id);
  }

  selectConversation(conversationId: string): void {
    if (this.isStreaming && this.activeConversation?.id !== conversationId) return;

    const conversation = this.conversations.find(conv => conv.id === conversationId);
    if (!conversation) return;

    this.activeConversation = conversation;
    this.conversationId = conversation.remoteConversationId;
    this.userId = conversation.userId;
    this.isTyping = false;
    this.isStreaming = false;
    this.currentStreamContent = '';
    this.userHasScrolledUp = false; // Reset scroll state khi chuyển conversation

    // Navigate to the chat room URL
    this.router.navigate(['/chat-room', conversation.remoteConversationId || conversation.id]);
    
    // Clear messages và load từ API
    const roomId = conversation.remoteConversationId || conversation.id;
    const cachedMessages = roomId ? this.messagesCache.get(roomId) : null;
    if (cachedMessages) {
      this.messages = [...cachedMessages];
    } else {
    this.messages = [];
    }
    this.cdr.detectChanges();
    
    // Load messages từ API nếu có remoteConversationId
    if (conversation.remoteConversationId) {
      this.loadMessagesFromAPI(conversation.remoteConversationId);
    }
  }
  
  /**
   * Tạo room cho conversation khi user gửi message đầu tiên
   */
  private async createRoomForConversation(conversation: Conversation): Promise<void> {
    return new Promise((resolve, reject) => {
      this.chatRoomService.createRoom().subscribe({
        next: (response) => {
          if (response.EC === 0 && response.data) {
            const room = response.data;
            
            // Update conversation với room_id từ API
            conversation.id = room.room_id;
            conversation.remoteConversationId = room.room_id;
            conversation.userId = room.user_id;
            conversation.createdAt = new Date(room.created_at).getTime();
            conversation.updatedAt = new Date(room.updated_at).getTime();
            
            // Update conversationId và userId để dùng cho chat
            this.conversationId = room.room_id;
            this.userId = room.user_id;
            
            resolve();
          } else {
            console.error('Failed to create room:', response.EM);
            reject(new Error(response.EM));
          }
        },
        error: (error) => {
          console.error('Error creating room from API:', error);
          reject(error);
        }
      });
    });
  }
  
  /**
   * Load danh sách conversations từ API để hiển thị sidebar
   * @param callback Function được gọi sau khi load xong conversations
   */
  loadConversationsList(callback?: () => void): void {
    let callbackCalled = false;

    // Load từ cache để hiển thị ngay
    const cached = this.loadConversationsFromCache();
    if (cached && cached.length > 0) {
      this.conversations = cached.sort((a, b) => b.updatedAt - a.updatedAt);
      if (callback) {
        callback();
        callbackCalled = true;
      }
    }

    this.isLoadingConversations = true;
    
    this.chatRoomService.getRooms(false, 50, 0).subscribe({
      next: (response) => {
        if (response.EC === 0 && response.data) {
          const apiConversations = response.data.map(room => ({
            id: room.room_id,
            title: room.title,
            createdAt: new Date(room.created_at).getTime(),
            updatedAt: new Date(room.updated_at).getTime(),
            remoteConversationId: room.room_id,
            userId: room.user_id
          }));
          
          this.conversations = apiConversations.sort((a, b) => b.updatedAt - a.updatedAt);
          this.saveConversationsToCache(this.conversations);
        } else {
          this.conversations = [];
        }
        
        if (!callbackCalled && callback) {
          callback();
        }
      },
      error: (error) => {
        console.error('Error loading conversations list:', error);
        // Keep cache if available; only clear if none
        if (!cached || cached.length === 0) {
        this.conversations = [];
        }
        
        if (!callbackCalled && callback) {
          callback();
        }
        this.isLoadingConversations = false;
      },
      complete: () => {
        this.isLoadingConversations = false;
      }
    });
  }

  /**
   * Load room theo roomId trong URL (nếu tồn tại), select và load messages
   */
  private async loadRoomFromUrl(roomId: string): Promise<void> {
    const existing = this.conversations.find(c => c.id === roomId || c.remoteConversationId === roomId);
    if (existing) {
      this.selectConversation(existing.id);
      return;
    }
    try {
      const roomResp = await this.chatRoomService.getRoom(roomId).toPromise();
      if (roomResp && roomResp.EC === 0 && roomResp.data) {
        const room = roomResp.data;
        const conv: Conversation = {
          id: room.room_id,
          title: room.title,
          createdAt: new Date(room.created_at).getTime(),
          updatedAt: new Date(room.updated_at).getTime(),
          remoteConversationId: room.room_id,
          userId: room.user_id
        };
        this.conversations.unshift(conv);
        this.selectConversation(conv.id);
        return;
      }
    } catch (e) {
      console.warn('Could not load room from URL, fallback to default conversation', e);
    }
    // fallback
    this.startNewConversation();
  }
  
  /**
   * Load messages from API for a room (chỉ load nếu chưa có cache)
   */
  loadMessagesFromAPI(roomId: string): void {
    // Chỉ load nếu đây là conversation đang active (tránh race condition)
    if (this.activeConversation?.remoteConversationId !== roomId) {
      return;
    }
    this.isLoadingMessages = true;
    
    this.chatRoomService.getRoomMessages(roomId, 100, 0).subscribe({
      next: (response) => {
        // Double check conversation vẫn active sau khi response về
        if (this.activeConversation?.remoteConversationId !== roomId) {
          return;
        }
        
        if (response.EC === 0 && response.data) {
          // Convert API messages to local message format
          const loadedMessages = response.data.map(msg => {
            const tourPackages = msg.entities?.tour_packages || [];
            return {
              content: msg.content,
              isUser: msg.role === 'user',
              tourPackages: tourPackages,
              showTourCards: tourPackages.length > 0,
              mcpUiResource: msg.entities?.mcp_ui_resource,
              mcpUiHtml: msg.entities?.mcp_ui_html
            };
          });
          
          // Update messages
          this.messages = loadedMessages;
          this.messagesCache.set(roomId, [...loadedMessages]);
          
          // Trigger change detection và scroll
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 100);
        }
      },
      error: (error) => {
        console.error('Error loading messages from API:', error);
        this.isLoadingMessages = false;
      },
      complete: () => {
        this.isLoadingMessages = false;
      }
    });
  }

  deleteConversation(conversationId: string): void {
    if (this.isStreaming || this.isDeletingConversation) return;

    const conversation = this.conversations.find(conv => conv.id === conversationId);
    if (!conversation) return;

    const wasActive = this.activeConversation?.id === conversationId;
    const index = this.conversations.findIndex(conv => conv.id === conversationId);

    // Optimistic remove
    this.isDeletingConversation = conversationId;
    const deletedConversation = this.conversations.splice(index, 1)[0];
    // Invalidate cache for this room
    if (deletedConversation.remoteConversationId) {
      this.messagesCache.delete(deletedConversation.remoteConversationId);
    }

            if (!this.conversations.length) {
              this.startNewConversation();
            } else if (wasActive) {
              const nextConversation = this.conversations[Math.min(index, this.conversations.length - 1)];
              this.selectConversation(nextConversation.id);
            }

    const finalize = () => {
      this.saveConversationsToCache(this.conversations);
      this.isDeletingConversation = null;
    };

    // Gọi API delete room nếu có remoteConversationId
    if (deletedConversation.remoteConversationId) {
      this.chatRoomService.deleteRoom(deletedConversation.remoteConversationId).subscribe({
        next: (response) => {
          if (response.EC !== 0) {
            console.error('Failed to delete room:', response.EM);
            // Rollback
            this.conversations.splice(index, 0, deletedConversation);
            this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
          }
        },
        error: (error) => {
          console.error('Error deleting room:', error);
          // Rollback
          this.conversations.splice(index, 0, deletedConversation);
          this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        },
        complete: finalize
      });
    } else {
      finalize();
    }
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
      console.warn('Timestamp format error:', error);
      return new Date(timestamp).toLocaleString();
    }
  }

  getConversationPreview(conversation: Conversation): string {
    // Không có cache messages nữa, chỉ hiển thị title
    return conversation.title || 'Cuộc trò chuyện';
  }

  private parseMarkdown(text: string): string {
    if (!text) return '';

    // Remove heading markers (##, ###) to avoid cluttering UI
    const stripped = text.replace(/^#{1,3}\s*/gm, '');

    // Replace long dashes with short dash for cleaner UI
    const dashCleaned = stripped.replace(/[—–]/g, '-');

    // Escape basic HTML
    const escaped = dashCleaned
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold
    const bolded = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Split by paragraph (double newline)
    const paragraphs = bolded.split(/\n\n+/);

    const htmlSegments = paragraphs.map((segment) => {
      const lines = segment.split(/\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return '';

      // Bullet list
      const isDashList = lines.every((l) => /^- /.test(l));
      const isNumList = lines.every((l) => /^\d+\.\s+/.test(l));

      if (isDashList) {
        const items = lines.map((l) => l.replace(/^- /, '')).map((item) => `<li>${item}</li>`).join('');
        return `<ul>${items}</ul>`;
      }

      if (isNumList) {
        const items = lines.map((l) => l.replace(/^\d+\.\s+/, '')).map((item) => `<li>${item}</li>`).join('');
        return `<ol>${items}</ol>`;
      }

      // Default paragraph with line breaks
      return lines.join('<br>');
    }).filter(Boolean);

    return htmlSegments.join('<br><br>');
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
      console.log('Searching for tour:', tourName);
      
      const normalizedSearchName = tourName.toLowerCase().trim();
      let foundTour = null;
      
      // Tìm trong recommended tours trước
      try {
        const recommendedTours = await this.tourService.getRecommendedTours(100);
        console.log('Available recommended tours:', recommendedTours.map(t => t.package_name));
        
        foundTour = recommendedTours.find(tour => {
          const normalizedTourName = tour.package_name.toLowerCase().trim();
          return normalizedTourName === normalizedSearchName ||
                 normalizedTourName.includes(normalizedSearchName) ||
                 normalizedSearchName.includes(normalizedTourName);
        });
      } catch (error) {
        console.log('Error loading recommended tours:', error);
      }
      
      // Nếu không tìm thấy trong recommended tours, tìm trong tất cả tours
      if (!foundTour) {
        try {
          const allTours = await this.tourService.getTours();
          console.log('Available all tours:', allTours.map(t => t.package_name));
          
          foundTour = allTours.find(tour => {
            const normalizedTourName = tour.package_name.toLowerCase().trim();
            return normalizedTourName === normalizedSearchName ||
                   normalizedTourName.includes(normalizedSearchName) ||
                   normalizedSearchName.includes(normalizedTourName);
          });
        } catch (error) {
          console.log('Error loading all tours:', error);
        }
      }

      if (foundTour && foundTour.package_id) {
        console.log('Found tour:', foundTour.package_name, 'ID:', foundTour.package_id);
        this.onClose();
        this.router.navigate(['/tour-details', foundTour.package_id]);
      } else {
        console.warn('Tour not found, redirecting to tours list');
        this.onClose();
        this.router.navigate(['/tours']);
      }
    } catch (error) {
      console.error('Error finding tour:', error);
      this.onClose();
      this.router.navigate(['/tours']);
    }
  }

  navigateToTourDetail(tourId: string): void {
    console.log('Navigating to tour detail:', tourId);
    console.log('Tour ID type:', typeof tourId);
    console.log('Tour ID value:', tourId);
    
    if (!tourId) {
      console.error('Tour ID is undefined or null');
      return;
    }
    
    this.onClose();
    this.router.navigate(['/tour-details', tourId]);
  }


  private scrollToBottom(): void {
    if (this.userHasScrolledUp) return; // Không scroll nếu user đã kéo lên
    if (this.messagesContainer) {
      const element = this.messagesContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  onMessagesScroll(): void {
    const el = this.messagesContainer?.nativeElement;
    if (!el) return;
    // User ở gần cuối (trong 100px) thì cho auto-scroll
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    this.userHasScrolledUp = !isNearBottom;
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
      console.warn('crypto.randomUUID unavailable:', error);
    }
    return Math.random().toString(36).slice(2, 11);
  }

  private getCurrentUserId(): string | null {
    const user = this.authStateService.getCurrentUser();
    if (user && user.user_id) return user.user_id;
    if (this.userId) return this.userId;
    return null;
  }

  private loadConversationsFromCache(): Conversation[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.conversationsCacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const userId = this.getCurrentUserId();
      if (!userId || parsed.userId !== userId) return [];
      const timestamp = parsed.timestamp || 0;
      if (Date.now() - timestamp > this.conversationsCacheTTL) return [];
      const conversations = parsed.conversations as Conversation[] || [];
      return conversations;
    } catch (e) {
      console.warn('Failed to load conversations cache', e);
      return [];
    }
  }

  private saveConversationsToCache(conversations: Conversation[]): void {
    if (typeof window === 'undefined') return;
    const userId = this.getCurrentUserId();
    if (!userId) return;
    try {
      const payload = {
        conversations,
        timestamp: Date.now(),
        userId
      };
      localStorage.setItem(this.conversationsCacheKey, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to save conversations cache', e);
    }
  }

  private touchConversation(conversation: Conversation, bump: boolean = true): void {
    conversation.updatedAt = Date.now();
    if (!bump) {
      return;
    }

    // Move conversation to top và sort lại
    const index = this.conversations.findIndex(conv => conv.id === conversation.id);
    if (index > 0) {
      this.conversations.splice(index, 1);
      this.conversations.unshift(conversation);
    } else if (index === -1) {
      // Nếu không tìm thấy, thêm vào đầu
      this.conversations.unshift(conversation);
    }
    
    // Đảm bảo sort by updatedAt descending (mới nhất lên đầu)
    this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  sanitizeHtml(html: string): SafeHtml {
    if (!html) return '';
    // Bypass security for payment button HTML to allow onclick handlers
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  ngOnDestroy(): void {
    // Clean up event listeners
    window.removeEventListener('message', this.paymentButtonClickHandler);
  }

  /**
   * Thêm message chúc mừng thanh toán thành công vào chat
   */
  private addPaymentSuccessMessage(): void {
    const successMessage: Message = {
      content: `🎉 **Chúc mừng bạn đã thanh toán thành công!**

Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ của chúng tôi. Đơn hàng của bạn đã được xác nhận và đang được xử lý.

**Những điều bạn cần biết:**
- Đơn hàng sẽ được xử lý trong vòng 24 giờ
- Bạn sẽ nhận được email xác nhận đơn hàng trong thời gian sớm nhất
- Bạn có thể xem chi tiết đơn hàng trong mục "Đơn hàng của tôi"

Nếu bạn có bất kỳ câu hỏi nào về đơn hàng hoặc cần hỗ trợ thêm, đừng ngần ngại hỏi tôi nhé! 😊`,
      isUser: false
    };
    
    this.messages.push(successMessage);
    this.cdr.detectChanges();
    
    // Scroll xuống để hiển thị message mới
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  // Handle payment button clicks from dynamically rendered HTML
  handlePaymentClick(paymentUrl: string, bookingId: string): void {
    console.log('Payment button clicked:', { paymentUrl, bookingId });
    if (paymentUrl) {
      // Lưu chat room URL vào sessionStorage để redirect về sau khi thanh toán
      const currentUrl = window.location.href;
      sessionStorage.setItem('payment_return_url', currentUrl);
      // KHÔNG modify payment URL - giữ nguyên như backend generate
      window.location.href = paymentUrl;
    }
  }

  // Handle clicks on payment button HTML (delegation)
  handlePaymentClickFromHtml(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Check if clicked element is payment button or inside it
    const button = target.closest('.mcp-payment-button') || target.closest('button[data-payment-url]');
    
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      
      // Prevent multiple clicks
      if (this.isProcessingPayment || button.hasAttribute('disabled')) {
        return;
      }
      
      // Đánh dấu loading
      this.isProcessingPayment = true;
      button.setAttribute('disabled', 'true');
      button.classList.add('loading');
      
      // Try data attributes first (preferred method)
      const paymentUrl = button.getAttribute('data-payment-url') || 
                        (button as HTMLElement).dataset['paymentUrl'];
      if (paymentUrl) {
        console.log('Extracted payment URL from data attribute:', paymentUrl);
        // Lưu chat room URL vào sessionStorage để redirect về sau khi thanh toán
        const currentUrl = window.location.href;
        sessionStorage.setItem('payment_return_url', currentUrl);
        // KHÔNG modify payment URL - giữ nguyên như backend generate
        window.location.href = paymentUrl;
        return;
      }
      
      // Fallback: try onclick attribute
      const onclickAttr = button.getAttribute('onclick');
      if (onclickAttr) {
        // Extract payment URL from onclick="handlePayment('url', 'id')"
        const urlMatch = onclickAttr.match(/handlePayment\(['"]([^'"]+)['"]/);
        if (urlMatch && urlMatch[1]) {
          const paymentUrl = urlMatch[1];
          console.log('Extracted payment URL from onclick:', paymentUrl);
          // Lưu chat room URL vào sessionStorage để redirect về sau khi thanh toán
          const currentUrl = window.location.href;
          sessionStorage.setItem('payment_return_url', currentUrl);
          // KHÔNG modify payment URL - giữ nguyên như backend generate
          window.location.href = paymentUrl;
          return;
        }
      }
      
      // Reset loading state nếu không tìm thấy URL
      this.isProcessingPayment = false;
      button.removeAttribute('disabled');
      button.classList.remove('loading');
      console.warn('Could not extract payment URL from button');
    }
  }

  // Attach click handlers to payment buttons after HTML is rendered
  private attachPaymentButtonHandlers(): void {
    const paymentButtons = document.querySelectorAll('.mcp-payment-button');
    paymentButtons.forEach((button) => {
      // Skip if already has handler (check for data attribute)
      if ((button as HTMLElement).dataset['handlerAttached'] === 'true') {
        return;
      }
      
      // Mark as handler attached
      (button as HTMLElement).dataset['handlerAttached'] = 'true';
      
      // Attach click handler
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Prevent multiple clicks
        if (this.isProcessingPayment || button.hasAttribute('disabled')) {
          return;
        }
        
        // Đánh dấu loading
        this.isProcessingPayment = true;
        button.setAttribute('disabled', 'true');
        button.classList.add('loading');
        
        const paymentUrl = button.getAttribute('data-payment-url') || 
                          (button as HTMLElement).dataset['paymentUrl'];
        if (paymentUrl) {
          console.log('Payment button clicked, redirecting to:', paymentUrl);
          // Lưu chat room URL vào sessionStorage để redirect về sau khi thanh toán
          const currentUrl = window.location.href;
          sessionStorage.setItem('payment_return_url', currentUrl);
          // KHÔNG modify payment URL - giữ nguyên như backend generate
          window.location.href = paymentUrl;
        } else {
          // Reset loading state nếu không tìm thấy URL
          this.isProcessingPayment = false;
          button.removeAttribute('disabled');
          button.classList.remove('loading');
          console.warn('Payment URL not found in button');
        }
      });
    });
  }
}