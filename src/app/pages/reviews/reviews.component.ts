import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService, Review, BookingForReview, ReviewCreate, ReviewUpdate } from '../../services/review.service';
import { AuthStateService } from '../../services/auth-state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reviews',
  imports: [CommonModule, FormsModule],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.scss'
})
export class ReviewsComponent implements OnInit {
  bookings: BookingForReview[] = [];
  reviews: Review[] = [];
  isLoading = false;
  errorMessage = '';
  
  // Form state
  showCreateForm = false;
  selectedBooking: BookingForReview | null = null;
  newReview: ReviewCreate = {
    booking_id: '',
    package_id: '',
    rating: 5,
    comment: ''
  };
  
  // Edit state
  editingReview: Review | null = null;
  editForm: ReviewUpdate = {
    rating: 5,
    comment: ''
  };

  constructor(
    private reviewService: ReviewService,
    private authStateService: AuthStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authStateService.getIsAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Load bookings and reviews in parallel
    Promise.all([
      this.reviewService.getAllBookingsForReview().toPromise(),
      this.reviewService.getUserReviews().toPromise()
    ]).then(([bookingsRes, reviewsRes]) => {
      if (bookingsRes && bookingsRes.EC === 0 && bookingsRes.data) {
        // Filter only completed/confirmed bookings and map to BookingForReview format
        this.bookings = bookingsRes.data
          .filter((b: any) => {
            const status = b.status || b.booking_status;
            return status === 'completed' || status === 'confirmed';
          })
          .map((b: any) => {
            // Handle nested tour_package object
            const tourPackage = b.tour_package || b.tour_packages || {};
            return {
              booking_id: b.booking_id,
              package_id: b.package_id || tourPackage.package_id || '',
              package_name: b.tour_name || tourPackage.package_name || b.package_name || 'Tour',
              destination: b.destination || tourPackage.destination || '',
              status: b.status || b.booking_status,
              booking_date: b.created_at || b.booking_date,
              tour_dates: b.start_date ? `${b.start_date} - ${b.end_date}` : (tourPackage.start_date ? `${tourPackage.start_date} - ${tourPackage.end_date}` : '')
            };
          })
          .filter((b: BookingForReview) => b.package_id); // Only include bookings with valid package_id
      }
      
      if (reviewsRes && reviewsRes.EC === 0 && reviewsRes.data) {
        this.reviews = reviewsRes.data;
      }
      
      this.isLoading = false;
    }).catch(error => {
      console.error('Error loading data:', error);
      this.errorMessage = 'Không thể tải dữ liệu. Vui lòng thử lại.';
      this.isLoading = false;
    });
  }

  openCreateForm(booking: BookingForReview): void {
    this.selectedBooking = booking;
    this.newReview = {
      booking_id: booking.booking_id,
      package_id: booking.package_id,
      rating: 5,
      comment: ''
    };
    this.showCreateForm = true;
  }

  closeCreateForm(): void {
    this.showCreateForm = false;
    this.selectedBooking = null;
    this.newReview = {
      booking_id: '',
      package_id: '',
      rating: 5,
      comment: ''
    };
  }

  createReview(): void {
    if (!this.newReview.booking_id || !this.newReview.package_id) {
      this.errorMessage = 'Vui lòng chọn tour để đánh giá.';
      return;
    }

    if (!this.newReview.rating || this.newReview.rating < 1 || this.newReview.rating > 5) {
      this.errorMessage = 'Vui lòng chọn số sao từ 1 đến 5.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.reviewService.createReview(this.newReview).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.closeCreateForm();
          this.loadData(); // Reload data
        } else {
          this.errorMessage = response.EM || 'Không thể tạo đánh giá.';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error creating review:', error);
        this.errorMessage = error.error?.EM || 'Có lỗi xảy ra khi tạo đánh giá.';
        this.isLoading = false;
      }
    });
  }

  openEditForm(review: Review): void {
    this.editingReview = review;
    this.editForm = {
      rating: review.rating,
      comment: review.comment || ''
    };
  }

  closeEditForm(): void {
    this.editingReview = null;
    this.editForm = {
      rating: 5,
      comment: ''
    };
  }

  updateReview(): void {
    if (!this.editingReview) return;

    if (!this.editForm.rating || this.editForm.rating < 1 || this.editForm.rating > 5) {
      this.errorMessage = 'Vui lòng chọn số sao từ 1 đến 5.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.reviewService.updateReview(this.editingReview.review_id, this.editForm).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.closeEditForm();
          this.loadData(); // Reload data
        } else {
          this.errorMessage = response.EM || 'Không thể cập nhật đánh giá.';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error updating review:', error);
        this.errorMessage = error.error?.EM || 'Có lỗi xảy ra khi cập nhật đánh giá.';
        this.isLoading = false;
      }
    });
  }

  deleteReview(review: Review): void {
    if (!confirm('Bạn có chắc chắn muốn xóa đánh giá này?')) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.reviewService.deleteReview(review.review_id).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.loadData(); // Reload data
        } else {
          this.errorMessage = response.EM || 'Không thể xóa đánh giá.';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error deleting review:', error);
        this.errorMessage = error.error?.EM || 'Có lỗi xảy ra khi xóa đánh giá.';
        this.isLoading = false;
      }
    });
  }

  hasReviewForBooking(bookingId: string): boolean {
    return this.reviews.some(r => r.booking_id === bookingId);
  }

  getReviewForBooking(bookingId: string): Review | undefined {
    return this.reviews.find(r => r.booking_id === bookingId);
  }

  getStarsArray(rating: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < rating);
  }
}
