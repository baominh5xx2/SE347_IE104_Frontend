import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Review } from '../../services/review.service';

@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './review-card.component.html',
  styleUrl: './review-card.component.scss'
})
export class ReviewCardComponent {
  @Input() review!: Review;
  avatarError = false;

  getStars(): boolean[] {
    return Array(5).fill(false).map((_, i) => i < this.review.rating);
  }

  getInitials(): string {
    const name = this.review.user_full_name || this.review.user_email || 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }

  onAvatarError(): void {
    this.avatarError = true;
  }

  shouldShowAvatar(): boolean {
    return !!(this.review.user_profile_picture && !this.avatarError);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  truncateComment(comment: string, maxLength: number = 150): string {
    if (!comment) return '';
    if (comment.length <= maxLength) return comment;
    return comment.substring(0, maxLength) + '...';
  }
}

