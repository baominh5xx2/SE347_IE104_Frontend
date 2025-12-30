import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { HeroComponent } from '../../components/hero/hero.component';
import { CouponListComponent } from '../../components/coupon-list/coupon-list.component';
import { TourCardComponent } from '../../components/tour-card/tour-card.component';
import { TravelNewsCardComponent } from '../../components/travel-news-card/travel-news-card.component';
import { TourService } from '../../services/tour.service';
import { TravelNewsService } from '../../services/travel-news.service';
import { FavoriteService } from '../../services/favorite.service';
import { ReviewService, Review } from '../../services/review.service';
import { Tour } from '../../shared/models/tour.model';
import { TravelNews } from '../../shared/models/travel-news.model';
import { AuthStateService } from '../../services/auth-state.service';
import { AuthService } from '../../services/auth.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { take } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { ReviewCardComponent } from '../../components/review-card/review-card.component';

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    RouterLink,
    HeroComponent, 
    CouponListComponent, 
    TourCardComponent,
    TravelNewsCardComponent,
    ReviewCardComponent,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  featuredTours: Tour[] = [];
  recommendedTours: Tour[] = [];
  latestTours: Tour[] = [];
  travelNews: TravelNews[] = [];
  featuredReviews: Review[] = [];
  isLoadingFeaturedTours = false;
  isLoadingTours = false;
  isLoadingLatestTours = false;
  isLoadingTravelNews = false;
  isLoadingReviews = false;
  errorMessageFeatured: string | null = null;
  errorMessageRecommended: string | null = null;
  errorMessageLatest: string | null = null;
  errorMessageTravelNews: string | null = null;
  errorMessageReviews: string | null = null;
  isAuthenticated = false;
  favoriteStatusMap: Map<string, boolean> = new Map();
  loadingFavorites: Set<string> = new Set();

  private observer?: IntersectionObserver;

  constructor(
    private tourService: TourService,
    private travelNewsService: TravelNewsService,
    private favoriteService: FavoriteService,
    private reviewService: ReviewService,
    private authStateService: AuthStateService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private elementRef: ElementRef,
    private messageService: MessageService
  ) {}

  async ngOnInit() {
    this.isAuthenticated = this.authStateService.getIsAuthenticated();
    
    this.authStateService.isAuthenticated$.subscribe(isAuth => {
      this.isAuthenticated = isAuth;
      if (isAuth) {
        this.loadFavoriteStatuses();
      }
    });

    // Check for Google OAuth token in query params - only process once
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const token = params['token'];
      if (token) {
        this.handleGoogleAuthToken(token);
      }
    });

    await Promise.all([
      this.loadFeaturedTours(),
      this.loadRecommendedTours(),
      this.loadLatestTours(),
      this.loadTravelNews(),
      this.loadFeaturedReviews()
    ]);
  }

  private handleGoogleAuthToken(token: string): void {
    console.log('Processing Google auth token...');
    
    // Store token first
    localStorage.setItem('access_token', token);
    
    // Remove token from URL immediately (before processing)
    this.router.navigate(['/home'], { 
      replaceUrl: true,
      queryParams: {}
    });
    
    // Verify token and login
    this.authService.verifyToken(token).subscribe({
      next: (response) => {
        console.log('Token verification response:', response);
        
        if (response.EC === 0 && response.data) {
          // Create user object from token data
          const user = {
            email: response.data.email || '',
            full_name: response.data.full_name || '',
            user_id: response.data.user_id || response.data.email || '',
            role: response.data.role || 'user'
          };
          
          console.log('User object created:', user);
          
          // Store user in localStorage
          localStorage.setItem('user', JSON.stringify(user));
          
          // Update auth state service to trigger UI update
          this.authStateService.login(token, user);
          
          console.log('User logged in successfully:', user.full_name);
        } else {
          console.error('Token verification failed:', response.EM);
          // Clear invalid token if verification failed
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
        }
      },
      error: (error) => {
        console.error('Token verification error:', error);
        // Clear invalid token
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    });
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
      
      if (this.isAuthenticated && this.featuredTours.length > 0) {
        this.loadFavoriteStatuses();
      }
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
      
      if (this.isAuthenticated && this.recommendedTours.length > 0) {
        this.loadFavoriteStatuses();
      }
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
      
      if (this.isAuthenticated && this.latestTours.length > 0) {
        this.loadFavoriteStatuses();
      }
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

  async loadFavoriteStatuses(): Promise<void> {
    if (!this.isAuthenticated) {
      return;
    }

    const allTours = [...this.featuredTours, ...this.recommendedTours, ...this.latestTours];
    if (allTours.length === 0) {
      return;
    }

    const promises = allTours.map(async (tour) => {
      try {
        const response = await this.favoriteService.checkFavorite(tour.package_id);
        this.favoriteStatusMap.set(tour.package_id, response.is_favorite);
      } catch (error) {
        console.error(`Error checking favorite for ${tour.package_id}:`, error);
        this.favoriteStatusMap.set(tour.package_id, false);
      }
    });

    await Promise.all(promises);
  }

  isFavorite(packageId: string): boolean {
    return this.favoriteStatusMap.get(packageId) || false;
  }

  isLoadingFavorite(packageId: string): boolean {
    // Always return false to prevent loading spinner - we want instant feedback
    return false;
  }

  async onToggleFavorite(packageId: string): Promise<void> {
    if (!this.isAuthenticated) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cần đăng nhập',
        detail: 'Vui lòng đăng nhập để thêm tour vào yêu thích',
        life: 3000
      });
      return;
    }

    // Prevent multiple clicks
    if (this.loadingFavorites.has(packageId)) {
      return;
    }

    // Add to loading set to prevent duplicate clicks (but don't show loading UI)
    this.loadingFavorites.add(packageId);

    // Optimistic UI update - update immediately for better UX
    const wasFavorite = this.isFavorite(packageId);
    const newFavoriteState = !wasFavorite;
    this.favoriteStatusMap.set(packageId, newFavoriteState);

    // Remove from loading immediately so no loading spinner shows
    // But keep a small delay to prevent rapid clicks
    setTimeout(() => {
      this.loadingFavorites.delete(packageId);
    }, 100);

    // Show success message immediately (before API call)
    this.messageService.add({
      severity: 'success',
      summary: newFavoriteState ? 'Đã thêm' : 'Đã xóa',
      detail: newFavoriteState 
        ? 'Đã thêm tour vào danh sách yêu thích' 
        : 'Đã xóa tour khỏi danh sách yêu thích',
      life: 2000
    });

    // Make API call in background (fire and forget)
    this.favoriteService[wasFavorite ? 'removeFavorite' : 'addFavorite'](packageId)
      .catch((error: any) => {
        console.error('Error toggling favorite:', error);
        // Revert optimistic update on error
        this.favoriteStatusMap.set(packageId, wasFavorite);
        // Show error message (replacing the success message)
        this.messageService.add({
          severity: 'error',
          summary: 'Lỗi',
          detail: error?.message || 'Không thể cập nhật trạng thái yêu thích',
          life: 3000
        });
      });
  }

  async loadTravelNews() {
    this.isLoadingTravelNews = true;
    this.errorMessageTravelNews = null;
    try {
      const response = await this.travelNewsService.getTravelNews(6);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        console.warn('Invalid travel news response format:', response);
        this.travelNews = [];
        this.errorMessageTravelNews = 'Định dạng dữ liệu không hợp lệ.';
        return;
      }
      
      if (response.data.length === 0) {
        this.travelNews = [];
        return;
      }
      
      this.travelNews = response.data;
      console.log('Travel news loaded:', this.travelNews.length);
    } catch (error: any) {
      console.error('Error loading travel news:', error);
      this.travelNews = [];
      this.errorMessageTravelNews = error?.message || 'Lỗi khi tải tin tức du lịch.';
    } finally {
      this.isLoadingTravelNews = false;
    }
  }

  async loadFeaturedReviews() {
    this.isLoadingReviews = true;
    this.errorMessageReviews = null;
    try {
      const response = await firstValueFrom(this.reviewService.getFeaturedReviews(5));
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        console.warn('Invalid reviews response format:', response);
        this.featuredReviews = [];
        this.errorMessageReviews = 'Định dạng dữ liệu không hợp lệ.';
        return;
      }
      
      if (response.data.length === 0) {
        this.featuredReviews = [];
        return;
      }
      
      this.featuredReviews = response.data;
      console.log('Featured reviews loaded:', this.featuredReviews.length);
    } catch (error: any) {
      console.error('Error loading featured reviews:', error);
      this.featuredReviews = [];
      this.errorMessageReviews = error?.message || 'Lỗi khi tải đánh giá khách hàng.';
    } finally {
      this.isLoadingReviews = false;
    }
  }
}
