import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroComponent } from '../../components/hero/hero.component';
import { CouponListComponent } from '../../components/coupon-list/coupon-list.component';
import { DestinationCardsComponent } from '../../components/destination-cards/destination-cards.component';
import { TravelOptionsComponent } from '../../components/travel-options/travel-options.component';
import { TourCardComponent } from '../../components/tour-card/tour-card.component';
import { TourService } from '../../services/tour.service';
import { Tour } from '../../shared/models/tour.model';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    HeroComponent, 
    CouponListComponent, 
    DestinationCardsComponent,
    TravelOptionsComponent,
    TourCardComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  recommendedTours: Tour[] = [];
  isLoadingTours = false;

  constructor(private tourService: TourService) {}

  async ngOnInit() {
    await this.loadRecommendedTours();
  }

  async loadRecommendedTours() {
    this.isLoadingTours = true;
    try {
      this.recommendedTours = await this.tourService.getRecommendedTours(6);
    } catch (error) {
      console.error('Error loading recommended tours:', error);
      this.recommendedTours = [];
    } finally {
      this.isLoadingTours = false;
    }
  }
}
