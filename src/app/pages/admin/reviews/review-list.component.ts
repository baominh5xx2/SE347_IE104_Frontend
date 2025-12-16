import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminReviewService, Review, ReviewDetail } from '../../../services/admin/admin-review.service';

@Component({
  selector: 'app-review-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './review-list.component.html',
  styleUrls: ['./review-list.component.scss']
})
export class ReviewListComponent implements OnInit {
  // Reviews list
  allReviews: Review[] = [];
  filteredReviews: Review[] = [];
  pendingReviews: Review[] = [];
  
  // Loading states
  isLoadingReviews: boolean = false;
  isLoadingPending: boolean = false;
  isApproving: boolean = false;
  isDeleting: boolean = false;
  
  // Filters
  filterStatus: 'all' | 'pending' | 'approved' | 'rejected' = 'all';
  filterRating: number | null = null;
  searchTerm: string = '';
  filterUserId: string = '';
  filterPackageId: string = '';
  
  // Pagination
  currentPage: number = 0;
  pageSize: number = 20;
  totalReviews: number = 0;
  
  // Selected review
  selectedReview: ReviewDetail | null = null;
  showDetailModal: boolean = false;
  showDeleteConfirmModal: boolean = false;
  
  // Messages
  errorMessage: string = '';
  successMessage: string = '';
  
  // Active tab
  activeTab: 'all' | 'pending' = 'all';

  // Expose Math to template
  Math = Math;

  constructor(
    private reviewService: AdminReviewService
  ) {}

  ngOnInit() {
    this.loadAllReviews();
    this.loadPendingReviews();
  }

  /**
   * Load all reviews
   */
  async loadAllReviews() {
    this.isLoadingReviews = true;
    this.errorMessage = '';
    
    try {
      const params: any = {
        limit: this.pageSize,
        offset: this.currentPage * this.pageSize
      };
      
      if (this.filterRating) {
        params.rating = this.filterRating;
      }
      
      if (this.filterUserId) {
        params.user_id = this.filterUserId;
      }
      
      if (this.filterPackageId) {
        params.package_id = this.filterPackageId;
      }
      
      if (this.filterStatus === 'approved') {
        params.is_approved = true;
      } else if (this.filterStatus === 'rejected') {
        params.is_approved = false;
      }
      
      const response = await this.reviewService.getAllReviewsAdmin(params).toPromise();
      
      if (response?.EC === 0) {
        this.allReviews = response.data;
        this.totalReviews = response.total;
        this.filterReviews();
      } else {
        this.errorMessage = response?.EM || 'Không thể tải danh sách reviews';
      }
    } catch (error: any) {
      this.errorMessage = error?.error?.EM || 'Lỗi khi tải danh sách reviews';
      console.error('Error loading reviews:', error);
    } finally {
      this.isLoadingReviews = false;
    }
  }

  /**
   * Load pending reviews
   */
  async loadPendingReviews() {
    this.isLoadingPending = true;
    
    try {
      const response = await this.reviewService.getPendingReviews({ limit: 100 }).toPromise();
      
      if (response?.EC === 0) {
        this.pendingReviews = response.data;
      }
    } catch (error: any) {
      console.error('Error loading pending reviews:', error);
    } finally {
      this.isLoadingPending = false;
    }
  }

  /**
   * Filter reviews by search term
   */
  filterReviews() {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredReviews = [...this.allReviews];
      return;
    }
    
    this.filteredReviews = this.allReviews.filter(review =>
      review.comment.toLowerCase().includes(term) ||
      review.review_id.toLowerCase().includes(term) ||
      review.user_id.toLowerCase().includes(term) ||
      review.package_id.toLowerCase().includes(term)
    );
  }

  /**
   * Switch tab
   */
  switchTab(tab: 'all' | 'pending') {
    this.activeTab = tab;
    if (tab === 'pending' && this.pendingReviews.length === 0) {
      this.loadPendingReviews();
    }
  }

  /**
   * Apply filters
   */
  applyFilters() {
    this.currentPage = 0;
    this.loadAllReviews();
  }

  /**
   * Clear filters
   */
  clearFilters() {
    this.filterStatus = 'all';
    this.filterRating = null;
    this.searchTerm = '';
    this.filterUserId = '';
    this.filterPackageId = '';
    this.applyFilters();
  }

  /**
   * Change page
   */
  changePage(page: number) {
    const totalPages = Math.ceil(this.totalReviews / this.pageSize);
    if (page < 0 || page >= totalPages) return;
    
    this.currentPage = page;
    this.loadAllReviews();
  }

  /**
   * View review details
   */
  async viewReviewDetails(review: Review) {
    try {
      const response = await this.reviewService.getReview(review.review_id).toPromise();
      if (response?.EC === 0 && response?.data) {
        this.selectedReview = response.data;
        this.showDetailModal = true;
      }
    } catch (error: any) {
      this.errorMessage = 'Không thể tải chi tiết review';
      console.error('Error loading review details:', error);
    }
  }

  /**
   * Close detail modal
   */
  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedReview = null;
  }

  /**
   * Approve review
   */
  async approveReview(review: Review, approve: boolean) {
    if (!confirm(`Bạn có chắc chắn muốn ${approve ? 'phê duyệt' : 'từ chối'} review này?`)) {
      return;
    }
    
    this.isApproving = true;
    this.errorMessage = '';
    
    try {
      const response = await this.reviewService.approveReview(review.review_id, {
        is_approved: approve
      }).toPromise();
      
      if (response?.EC === 0) {
        this.successMessage = `${approve ? 'Phê duyệt' : 'Từ chối'} review thành công!`;
        await this.loadAllReviews();
        await this.loadPendingReviews();
        setTimeout(() => this.successMessage = '', 3000);
      } else {
        this.errorMessage = response?.EM || `Không thể ${approve ? 'phê duyệt' : 'từ chối'} review`;
      }
    } catch (error: any) {
      this.errorMessage = error?.error?.EM || 'Lỗi khi cập nhật review';
      console.error('Error approving review:', error);
    } finally {
      this.isApproving = false;
    }
  }

  /**
   * Open delete confirm modal
   */
  openDeleteConfirmModal(review: Review) {
    this.selectedReview = review as ReviewDetail;
    this.showDeleteConfirmModal = true;
  }

  /**
   * Close delete confirm modal
   */
  closeDeleteConfirmModal() {
    this.showDeleteConfirmModal = false;
    this.selectedReview = null;
  }

  /**
   * Delete review
   */
  async deleteReview() {
    if (!this.selectedReview) return;
    
    this.isDeleting = true;
    this.errorMessage = '';
    
    try {
      const response = await this.reviewService.deleteReview(this.selectedReview.review_id).toPromise();
      
      if (response?.EC === 0) {
        this.successMessage = 'Xóa review thành công!';
        this.closeDeleteConfirmModal();
        await this.loadAllReviews();
        await this.loadPendingReviews();
        setTimeout(() => this.successMessage = '', 3000);
      } else {
        this.errorMessage = response?.EM || 'Không thể xóa review';
      }
    } catch (error: any) {
      this.errorMessage = error?.error?.EM || 'Lỗi khi xóa review';
      console.error('Error deleting review:', error);
    } finally {
      this.isDeleting = false;
    }
  }

  /**
   * Format date
   */
  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN');
  }

  /**
   * Get rating stars
   */
  getStars(rating: number): string[] {
    return Array(5).fill('').map((_, i) => i < rating ? 'full' : 'empty');
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(isApproved: boolean): string {
    return isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  }

  /**
   * Get status text
   */
  getStatusText(isApproved: boolean): string {
    return isApproved ? 'Đã phê duyệt' : 'Chờ phê duyệt';
  }

  /**
   * Get total pages
   */
  getTotalPages(): number {
    return Math.ceil(this.totalReviews / this.pageSize);
  }

  /**
   * Get page numbers
   */
  getPageNumbers(): number[] {
    const total = this.getTotalPages();
    const pages: number[] = [];
    const maxPages = 5;
    
    let start = Math.max(0, this.currentPage - Math.floor(maxPages / 2));
    let end = Math.min(total, start + maxPages);
    
    if (end - start < maxPages) {
      start = Math.max(0, end - maxPages);
    }
    
    for (let i = start; i < end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  /**
   * Get approved reviews count
   */
  getApprovedReviews(): number {
    return this.allReviews.filter(r => r.is_approved).length;
  }

  /**
   * Get average rating
   */
  getAverageRating(): string {
    if (this.allReviews.length === 0) return '0.0';
    const sum = this.allReviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / this.allReviews.length).toFixed(1);
  }
}
