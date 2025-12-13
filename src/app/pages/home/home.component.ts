import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeroComponent } from '../../components/hero/hero.component';
import { CouponListComponent } from '../../components/coupon-list/coupon-list.component';
import { TourCardComponent } from '../../components/tour-card/tour-card.component';
import { TourService } from '../../services/tour.service';
import { Tour } from '../../shared/models/tour.model';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    RouterLink,
    HeroComponent, 
    CouponListComponent, 
    TourCardComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  featuredTours: Tour[] = [];
  recommendedTours: Tour[] = [];
  latestTours: Tour[] = [];
  isLoadingFeaturedTours = false;
  isLoadingTours = false;
  isLoadingLatestTours = false;
  errorMessageFeatured: string | null = null;
  errorMessageRecommended: string | null = null;
  errorMessageLatest: string | null = null;

  private observer?: IntersectionObserver;

  constructor(
    private tourService: TourService,
    private authStateService: AuthStateService,
    private elementRef: ElementRef
  ) {}

  async ngOnInit() {
    await Promise.all([
      this.loadFeaturedTours(),
      this.loadRecommendedTours(),
      this.loadLatestTours()
    ]);
  }

  ngAfterViewInit() {
    this.initScrollAnimations();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private initScrollAnimations() {
    const options = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          this.observer?.unobserve(entry.target);
        }
      });
    }, options);

    const sections = this.elementRef.nativeElement.querySelectorAll('.section-animate');
    sections.forEach((section: Element) => {
      this.observer?.observe(section);
    });
  }

  async loadFeaturedTours() {
    this.isLoadingFeaturedTours = true;
    this.errorMessageFeatured = null;
    try {
      const response = await this.tourService.getTourPackages({ 
        is_active: true, 
        limit: 50 
      });
      
      if (!response || !response.packages || !Array.isArray(response.packages)) {
        console.warn('Invalid response format:', response);
        this.featuredTours = [];
        this.errorMessageFeatured = 'Định dạng dữ liệu không hợp lệ.';
        return;
      }
      
      if (response.packages.length === 0) {
        this.featuredTours = [];
        return;
      }
      
      const featuredTours = response.packages
        .filter(tour => tour.rating && tour.rating >= 4.0)
        .sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          const reviewsA = a.reviews || 0;
          const reviewsB = b.reviews || 0;
          
          if (ratingB !== ratingA) {
            return ratingB - ratingA;
          }
          
          return reviewsB - reviewsA;
        })
        .slice(0, 12);
      
      this.featuredTours = featuredTours.length > 0 
        ? featuredTours 
        : response.packages.slice(0, 12);
    } catch (error: any) {
      console.error('Error loading featured tours:', error);
      this.featuredTours = [];
      this.errorMessageFeatured = error?.message || 'Lỗi khi tải tour nổi bật.';
    } finally {
      this.isLoadingFeaturedTours = false;
    }
  }

  async loadRecommendedTours() {
    this.isLoadingTours = true;
    this.errorMessageRecommended = null;
    try {
      const isAuthenticated = this.authStateService.getIsAuthenticated();
      const currentUser = this.authStateService.getCurrentUser();
      const userId = currentUser?.user_id || currentUser?.id || 'anonymous';
      
      console.log('Loading recommended tours:', { isAuthenticated, userId, currentUser });
      
      try {
        const response = await this.tourService.recommendTourPackages({
          user_id: userId,
          k: 12
        });
        
        console.log('Recommended tours API response:', response);
        
        if (response && response.packages && Array.isArray(response.packages) && response.packages.length > 0) {
          this.recommendedTours = response.packages;
          console.log('Recommended tours loaded:', this.recommendedTours.length);
          return;
        } else {
          console.warn('Recommended tours API returned empty packages, falling back to default');
        }
      } catch (error: any) {
        console.warn('Error loading recommended tours from API, falling back to default:', error);
        if (error?.message) {
          console.warn('Error details:', error.message);
        }
      }
      
      const response = await this.tourService.getTourPackages({ 
        is_active: true, 
        limit: 50 
      });
      
      if (!response || !response.packages || !Array.isArray(response.packages)) {
        this.recommendedTours = [];
        this.errorMessageRecommended = 'Định dạng dữ liệu không hợp lệ.';
        return;
      }
      
      if (response.packages.length === 0) {
        this.recommendedTours = [];
        return;
      }
      
      const shuffledTours = this.shuffleArray([...response.packages]);
      this.recommendedTours = shuffledTours.slice(0, 12);
      console.log('Fallback recommended tours loaded:', this.recommendedTours.length);
    } catch (error: any) {
      console.error('Error loading recommended tours:', error);
      this.recommendedTours = [];
      this.errorMessageRecommended = error?.message || 'Lỗi khi tải tour đề xuất.';
    } finally {
      this.isLoadingTours = false;
    }
  }

  async loadLatestTours() {
    this.isLoadingLatestTours = true;
    this.errorMessageLatest = null;
    try {
      const response = await this.tourService.getTourPackages({ 
        is_active: true, 
        limit: 50 
      });
      
      if (!response || !response.packages || !Array.isArray(response.packages)) {
        this.latestTours = [];
        this.errorMessageLatest = 'Định dạng dữ liệu không hợp lệ.';
        return;
      }
      
      const toursWithDate = response.packages.filter(tour => tour.created_at);
      
      if (toursWithDate.length === 0) {
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
    } catch (error: any) {
      console.error('Error loading latest tours:', error);
      this.latestTours = [];
      this.errorMessageLatest = error?.message || 'Lỗi khi tải tour mới nhất.';
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

  getDisplayedFeaturedTours(): Tour[] {
    return this.featuredTours.slice(0, 6);
  }

  getDisplayedRecommendedTours(): Tour[] {
    return this.recommendedTours.slice(0, 6);
  }

  getDisplayedLatestTours(): Tour[] {
    return this.latestTours.slice(0, 6);
  }
}
