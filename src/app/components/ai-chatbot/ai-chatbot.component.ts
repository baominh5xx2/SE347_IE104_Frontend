import { Component, ElementRef, EventEmitter, Output, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ChatService } from '../../services/chat.service';
import { TourService } from '../../services/tour.service';

interface TourSelection {
  name: string;
  price: number;
  index: number;
}

interface Message {
  content: string;
  isUser: boolean;
  tours?: any[];
  tourSelections?: TourSelection[];
  isError?: boolean;
}

@Component({
  selector: 'app-ai-chatbot',
  imports: [CommonModule, NgIf, FormsModule],
  templateUrl: './ai-chatbot.component.html',
  styleUrl: './ai-chatbot.component.scss'
})
export class AiChatbotComponent {
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

  constructor(
    private chatService: ChatService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private tourService: TourService
  ) {}

  onClose(): void {
    this.close.emit();
  }

  async sendMessage(): Promise<void> {
    if (this.isStreaming || !this.userMessage.trim()) return;

    const message = this.userMessage.trim();
    this.messages.push({ content: message, isUser: true });
    this.userMessage = '';
    
    if (this.messageInputRef && this.messageInputRef.nativeElement) {
      this.messageInputRef.nativeElement.style.height = 'auto';
    }
    
    this.isStreaming = true;
    this.isTyping = true;
    this.headerStatus = 'Thinking...';
    
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
                  setTimeout(() => this.scrollToBottom(), 0);
                  break;
                  
                case 'recommendations':
                  console.log('Recommendations received:', event.data);
                  if (assistantMessage && event.data) {
                    assistantMessage.tours = event.data;
                    console.log('Tours assigned to message:', assistantMessage.tours);
                    if (assistantMessage.tours) {
                      console.log('Tour IDs:', assistantMessage.tours.map(t => ({ name: t.package_name, id: t.package_id })));
                    }
                    this.cdr.detectChanges();
                  }
                  setTimeout(() => this.scrollToBottom(), 100);
                  break;
                  
                case 'complete':
                  console.log('Complete:', event.full_response);
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
                  break;
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }

      this.headerStatus = 'Online';
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
}
