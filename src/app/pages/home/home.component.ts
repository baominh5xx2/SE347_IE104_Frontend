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
  latestTours: Tour[] = [];
  isLoadingTours = false;
  isLoadingLatestTours = false;

  constructor(private tourService: TourService) {}

  async ngOnInit() {
    await Promise.all([
      this.loadRecommendedTours(),
      this.loadLatestTours()
    ]);
  }

  async loadRecommendedTours() {
    this.isLoadingTours = true;
    try {
      const response = await this.tourService.getTourPackages({ 
        is_active: true, 
        limit: 50 
      });
      
      console.log('Recommended tours response:', response);
      
      if (!response || !response.packages || !Array.isArray(response.packages)) {
        console.warn('Invalid response format:', response);
        this.recommendedTours = [];
        return;
      }
      
      if (response.packages.length === 0) {
        console.warn('No tours found in response');
        this.recommendedTours = [];
        return;
      }
      
      const shuffledTours = this.shuffleArray([...response.packages]);
      this.recommendedTours = shuffledTours.slice(0, 12);
      console.log('Loaded recommended tours:', this.recommendedTours.length);
    } catch (error) {
      console.error('Error loading recommended tours:', error);
      this.recommendedTours = [];
    } finally {
      this.isLoadingTours = false;
    }
  }

  async loadLatestTours() {
    this.isLoadingLatestTours = true;
    try {
      const response = await this.tourService.getTourPackages({ 
        is_active: true, 
        limit: 50 
      });
      
      console.log('Latest tours response:', response);
      
      if (!response || !response.packages || !Array.isArray(response.packages)) {
        console.warn('Invalid response format:', response);
        this.latestTours = [];
        return;
      }
      
      const toursWithDate = response.packages.filter(tour => tour.created_at);
      
      if (toursWithDate.length === 0) {
        console.warn('No tours with created_at found, using all tours');
        this.latestTours = response.packages.slice(0, 8);
        return;
      }
      
      this.latestTours = toursWithDate
        .sort((a, b) => {
          const dateA = new Date(a.created_at!).getTime();
          const dateB = new Date(b.created_at!).getTime();
          return dateB - dateA;
        })
        .slice(0, 8);
      
      console.log('Loaded latest tours:', this.latestTours.length);
    } catch (error) {
      console.error('Error loading latest tours:', error);
      this.latestTours = [];
    } finally {
      this.isLoadingLatestTours = false;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
