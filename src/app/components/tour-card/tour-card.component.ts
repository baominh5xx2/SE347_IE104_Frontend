import { Component, Input } from '@angular/core';
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
}
