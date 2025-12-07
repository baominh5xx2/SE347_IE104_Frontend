import { Component, ElementRef, EventEmitter, Output, ViewChild, ChangeDetectorRef, OnInit, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

  constructor(
    private chatService: ChatService,
    private chatRoomService: ChatRoomService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private tourService: TourService,
    private authStateService: AuthStateService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    if (!this.authStateService.getIsAuthenticated()) {
      this.onClose();
      this.router.navigate(['/login']);
      return;
    }

    // Clear any old localStorage cache (if exists)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ai.chatbot.conversations');
      } catch (e) {
        // Ignore errors
      }
    }

    // Clear conversations và load từ API
    this.conversations = [];
    this.messages = [];
    
    // Load conversations list trước, sau đó mới quyết định tạo mới hay load conversation cũ
    this.loadConversationsList(() => {
      // Sau khi load conversations xong, kiểm tra có conversation nào không
      if (this.conversations.length > 0) {
        // Có conversations → tự động select conversation đầu tiên (mới nhất) để load messages
        const firstConversation = this.conversations[0];
        this.selectConversation(firstConversation.id);
      } else {
        // Không có conversations → tạo conversation mới
        this.startNewConversation();
      }
    });
  }

  onClose(): void {
    this.close.emit();
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

    // Thêm user message vào UI
    const userMessageObj: Message = { content: message, isUser: true };
    this.messages.push(userMessageObj);
    this.userMessage = '';

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
                      '1. Backend is running at http://localhost:8000<br>' +
                      '2. Backend has configured CORS<br>' +
                      '3. API URL is in correct format';
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
    
    let html = this.parseMarkdown(content);
    
    return html;
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
    
    // Clear messages và load từ API
    this.messages = [];
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
    // Clear conversations trước khi load
    this.conversations = [];
    
    this.chatRoomService.getRooms(false, 50, 0).subscribe({
      next: (response) => {
        if (response.EC === 0 && response.data) {
          // Convert API rooms to local conversation format
          const apiConversations = response.data.map(room => ({
            id: room.room_id,
            title: room.title,
            createdAt: new Date(room.created_at).getTime(),
            updatedAt: new Date(room.updated_at).getTime(),
            remoteConversationId: room.room_id,
            userId: room.user_id
          }));
          
          // Replace conversations với data từ API
          this.conversations = apiConversations;
          this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        } else {
          // Nếu API không trả về data, clear conversations
          this.conversations = [];
        }
        
        // Gọi callback sau khi load xong
        if (callback) {
          callback();
        }
      },
      error: (error) => {
        console.error('Error loading conversations list:', error);
        // Clear conversations nếu có lỗi
        this.conversations = [];
        
        // Vẫn gọi callback để không block UI
        if (callback) {
          callback();
        }
      }
    });
  }
  
  /**
   * Load messages from API for a room (chỉ load nếu chưa có cache)
   */
  loadMessagesFromAPI(roomId: string): void {
    // Chỉ load nếu đây là conversation đang active (tránh race condition)
    if (this.activeConversation?.remoteConversationId !== roomId) {
      return;
    }
    
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
          
          // Trigger change detection và scroll
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 100);
        }
      },
      error: (error) => {
        console.error('Error loading messages from API:', error);
      }
    });
  }

  deleteConversation(conversationId: string): void {
    if (this.isStreaming) return;

    const conversation = this.conversations.find(conv => conv.id === conversationId);
    if (!conversation) return;

    const wasActive = this.activeConversation?.id === conversationId;
    const index = this.conversations.findIndex(conv => conv.id === conversationId);

    // Gọi API delete room nếu có remoteConversationId
    if (conversation.remoteConversationId) {
      this.chatRoomService.deleteRoom(conversation.remoteConversationId).subscribe({
        next: (response) => {
          if (response.EC === 0) {
            // Xóa khỏi local list
            this.conversations.splice(index, 1);

            if (!this.conversations.length) {
              this.startNewConversation();
            } else if (wasActive) {
              const nextConversation = this.conversations[Math.min(index, this.conversations.length - 1)];
              this.selectConversation(nextConversation.id);
            }
          } else {
            console.error('Failed to delete room:', response.EM);
            alert('Không thể xóa cuộc trò chuyện. Vui lòng thử lại.');
          }
        },
        error: (error) => {
          console.error('Error deleting room:', error);
          alert('Có lỗi xảy ra khi xóa cuộc trò chuyện. Vui lòng thử lại.');
        }
      });
    } else {
      // Nếu chưa có room (chưa gửi message), chỉ xóa local
      this.conversations.splice(index, 1);

      if (!this.conversations.length) {
        this.startNewConversation();
      } else if (wasActive) {
        const nextConversation = this.conversations[Math.min(index, this.conversations.length - 1)];
        this.selectConversation(nextConversation.id);
      }
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
    
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^(\d+)\.\s+(.+)$/gm, '<div class="list-item"><span class="list-number">$1.</span> $2</div>')
      .replace(/\r\n|\r|\n/g, '<br>');
    
    return html;
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
    console.log('Navigating to tour detail:', tourId);
    console.log('Tour ID type:', typeof tourId);
    console.log('Tour ID value:', tourId);
    
    if (!tourId) {
      console.error('Tour ID is undefined or null');
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
    const sanitized = this.sanitizer.sanitize(SecurityContext.HTML, html);
    return this.sanitizer.bypassSecurityTrustHtml(sanitized || '');
  }
}