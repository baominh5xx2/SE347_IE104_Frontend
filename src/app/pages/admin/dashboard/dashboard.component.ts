import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReportService } from '../../../services/admin/admin-report.service';
import { AdminBookingService } from '../../../services/admin/admin-booking.service';
import { AdminReviewService } from '../../../services/admin/admin-review.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  // Stats
  totalRevenue = 0;
  revenueGrowth = 0;
  pendingBookings = 0;
  otpSentBookings = 0;
  totalBookings = 0;
  confirmedBookings = 0;
  cancelledBookings = 0;
  completedBookings = 0;
  
  // Review stats
  totalReviews = 0;
  averageRating = 0;
  
  // Loading states
  isLoading = true;
  errorMessage = '';

  // Revenue data for chart
  revenueData: any[] = [];
  revenueChartData: { period: string; revenue: number; bookings: number }[] = [];

  // Booking status distribution
  bookingStatusData: { status: string; count: number; color: string; label: string }[] = [];

  constructor(
    private reportService: ReportService,
    private bookingService: AdminBookingService,
    private reviewService: AdminReviewService
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.isLoading = true;
    this.errorMessage = '';

    // Load all data
    Promise.all([
      this.loadRevenueData(),
      this.loadBookingStats(),
      this.loadReviewStats()
    ]).then(() => {
      this.isLoading = false;
    }).catch(error => {
      this.errorMessage = 'Không thể tải dữ liệu dashboard';
      this.isLoading = false;
      console.error('Dashboard error:', error);
    });
  }

  async loadRevenueData() {
    try {
      console.log('📈 Loading revenue data...');
      const response = await this.reportService.getRevenueReport({
        period_type: 'month',
        num_periods: 12
      }).toPromise();

      console.log('📈 Revenue API response:', response);

      if (response && response.EC === 0) {
        this.totalRevenue = response.total_revenue || 0;
        this.revenueChartData = (response.data || []).map(item => ({
          period: this.formatPeriodToMonth(item.period || ''),
          revenue: item.revenue || 0,
          bookings: item.bookings || 0
        }));
        
        console.log('📈 Processed revenue data:', this.revenueChartData);
        console.log('📈 Total revenue:', this.totalRevenue);
        
        // Calculate growth (compare last 2 months)
        if (this.revenueChartData.length >= 2) {
          const lastMonth = this.revenueChartData[this.revenueChartData.length - 1].revenue;
          const previousMonth = this.revenueChartData[this.revenueChartData.length - 2].revenue;
          if (previousMonth > 0) {
            this.revenueGrowth = ((lastMonth - previousMonth) / previousMonth) * 100;
          } else {
            this.revenueGrowth = 0;
          }
        }
      } else {
        console.error('❌ Revenue API returned error:', response?.EM);
      }
    } catch (error) {
      console.error('❌ Error loading revenue:', error);
      this.totalRevenue = 0;
      this.revenueChartData = [];
      this.revenueGrowth = 0;
    }
  }

  async loadBookingStats() {
    try {
      // Load all bookings to get total (use limit=100 to match backend constraint)
      const allBookings = await this.bookingService.getAllBookingsAdmin({
        limit: 100
      }).toPromise();

      if (allBookings && allBookings.EC === 0) {
        this.totalBookings = allBookings.total || 0;
        
        // Count by status
        const bookings = allBookings.data || [];
        this.confirmedBookings = bookings.filter((b: any) => b.status === 'confirmed').length;
        this.completedBookings = bookings.filter((b: any) => b.status === 'completed').length;
        this.cancelledBookings = bookings.filter((b: any) => b.status === 'cancelled').length;
        this.otpSentBookings = bookings.filter((b: any) => b.status === 'otp_sent').length;
        
        // Prepare status distribution data
        this.bookingStatusData = [
          { status: 'pending', count: 0, color: 'bg-yellow-500', label: 'Chờ thanh toán' },
          { status: 'otp_sent', count: this.otpSentBookings, color: 'bg-cyan-500', label: 'OTP đã gửi' },
          { status: 'confirmed', count: this.confirmedBookings, color: 'bg-green-500', label: 'Đã xác nhận' },
          { status: 'completed', count: this.completedBookings, color: 'bg-blue-500', label: 'Hoàn thành' },
          { status: 'cancelled', count: this.cancelledBookings, color: 'bg-red-500', label: 'Đã hủy' }
        ];
      }

      // Load pending bookings
      const pendingBookings = await this.bookingService.getAllBookingsAdmin({
        status: 'pending',
        limit: 100
      }).toPromise();

      if (pendingBookings && pendingBookings.EC === 0) {
        this.pendingBookings = pendingBookings.total || 0;
        // Update pending count in status data
        const pendingIndex = this.bookingStatusData.findIndex(s => s.status === 'pending');
        if (pendingIndex !== -1) {
          this.bookingStatusData[pendingIndex].count = this.pendingBookings;
        }
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    }
  }

  async loadReviewStats() {
    try {
      console.log('⭐ Loading review stats...');
      const response = await this.reviewService.getReviews({ limit: 100 }).toPromise();
      
      if (response && response.EC === 0) {
        this.totalReviews = response.total || 0;
        
        // Calculate average rating
        const reviews = response.data || [];
        if (reviews.length > 0) {
          const totalRating = reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0);
          this.averageRating = totalRating / reviews.length;
        }
        
        console.log('⭐ Review stats loaded:', this.totalReviews, 'avg:', this.averageRating);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      this.totalReviews = 0;
      this.averageRating = 0;
    }
  }

  formatPrice(price: number): string {
    if (price === null || price === undefined || isNaN(price)) {
      return '0 ₫';
    }
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  formatNumber(num: number): string {
    if (num === null || num === undefined || isNaN(num)) {
      return '0';
    }
    return new Intl.NumberFormat('vi-VN').format(num);
  }

  getRevenueBarHeight(revenue: number): string {
    if (!this.revenueChartData || this.revenueChartData.length === 0) return '20px';
    if (revenue === null || revenue === undefined || isNaN(revenue)) return '20px';
    
    const maxRevenue = Math.max(...this.revenueChartData.map(d => d.revenue || 0));
    if (maxRevenue === 0) return '20px';
    
    const percentage = (revenue / maxRevenue) * 100;
    // Minimum 20px height for visibility
    const minHeight = 20;
    const calculatedHeight = Math.max(minHeight, (percentage / 100) * 256); // 256px = max height
    return `${Math.min(256, calculatedHeight)}px`;
  }

  getStatusPercentage(count: number): number {
    if (this.totalBookings === 0) return 0;
    return (count / this.totalBookings) * 100;
  }

  getStatusWidth(count: number): string {
    return `${this.getStatusPercentage(count)}%`;
  }

  formatPeriodToMonth(period: string): string {
    // Convert "2024-W52" to "12/2024" or "2024-12" to "12/2024"
    if (period.includes('-W')) {
      // Week format: extract year and approximate month
      const [year] = period.split('-W');
      return `${year}`;
    } else if (period.includes('-')) {
      // Month format: 2024-12 -> 12/2024
      const [year, month] = period.split('-');
      return `${month}/${year}`;
    }
    return period;
  }
}
