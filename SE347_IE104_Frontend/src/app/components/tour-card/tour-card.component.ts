import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Tour } from '../../shared/models/tour.model';

@Component({
  selector: 'app-tour-card',
  imports: [CommonModule, RouterLink],
  templateUrl: './tour-card.component.html',
  styleUrl: './tour-card.component.scss'
})
export class TourCardComponent {
  @Input() tour!: Tour;
  @Input() showDetails: boolean = true;
  @Input() isAuthenticated: boolean = false;
  @Input() isFavorite: boolean = false;
  @Input() isLoadingFavorite: boolean = false;
  @Output() viewDetails = new EventEmitter<string>();
  @Output() toggleFavorite = new EventEmitter<string>();

  // Parse image_urls (pipe-separated) into array
  getImageUrls(): string[] {
    if (this.tour.image_urls) {
      const urls = this.tour.image_urls.split('|').filter(url => url.trim());
      // Reverse to get last image as featured (as per user requirement)
      return urls.reverse();
    }
    return this.tour.image_url ? [this.tour.image_url] : [];
  }

  // Get featured image (last image in reversed list)
  getFeaturedImage(): string {
    const urls = this.getImageUrls();
    return urls.length > 0 ? urls[0] : (this.tour.image_url || 'img/tour-default.jpg');
  }

  // Get gallery images (next 3 images after featured)
  getGalleryImages(): string[] {
    const urls = this.getImageUrls();
    return urls.length > 1 ? urls.slice(1, 4) : []; // Get 3 images after featured
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  getDiscountedPrice(): number {
    if (this.tour.discount && this.tour.original_price) {
      return this.tour.original_price * (1 - this.tour.discount / 100);
    }
    return this.tour.price;
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
      console.warn('Date format error:', error);
      return dateString;
    }
  }

  getShortDescription(): string {
    if (!this.tour.description) return '';
    const maxLength = 120;
    if (this.tour.description.length <= maxLength) {
      return this.tour.description;
    }
    return this.tour.description.substring(0, maxLength) + '...';
  }

  isNewTour(): boolean {
    if (!this.tour.created_at) return false;
    const createdDate = new Date(this.tour.created_at);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30;
  }

  getCategoryName(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'beach': 'Biển',
      'mountain': 'Núi',
      'city': 'Thành phố',
      'cultural': 'Văn hóa',
      'adventure': 'Phiêu lưu',
      'relax': 'Nghỉ dưỡng'
    };
    return categoryMap[category] || category;
  }

  openImage(url: string): void {
    window.open(url, '_blank');
  }

  onViewDetailsClick(event: Event): void {
    // Emit event để parent component (chatbot) xử lý navigate và đóng chatbot
    if (this.viewDetails.observers.length > 0) {
      event.preventDefault();
      this.viewDetails.emit(this.tour.package_id);
    }
    // Nếu không có listener, để RouterLink hoạt động bình thường
  }

  onFavoriteClick(event: Event): void {
    // Prevent all default behaviors and stop propagation
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Prevent if already loading
    if (this.isLoadingFavorite) {
      return;
    }
    
    // Emit the event
    this.toggleFavorite.emit(this.tour.package_id);
  }
}
