import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReportService } from '../../../services/admin/admin-report.service';
import { AdminBookingService } from '../../../services/admin/admin-booking.service';

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
  totalBookings = 0;
  confirmedBookings = 0;
  cancelledBookings = 0;
  completedBookings = 0;
  
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
    private bookingService: AdminBookingService
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
      this.loadBookingStats()
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
      const response = await this.reportService.getRevenueReport({
        period_type: 'month',
        num_periods: 12
      }).toPromise();

      if (response && response.EC === 0) {
        this.totalRevenue = response.total_revenue || 0;
        this.revenueChartData = response.data || [];
        
        // Calculate growth (compare last 2 months)
        if (this.revenueChartData.length >= 2) {
          const lastMonth = this.revenueChartData[this.revenueChartData.length - 1].revenue;
          const previousMonth = this.revenueChartData[this.revenueChartData.length - 2].revenue;
          if (previousMonth > 0) {
            this.revenueGrowth = ((lastMonth - previousMonth) / previousMonth) * 100;
          }
        }
      }
    } catch (error) {
      console.error('Error loading revenue:', error);
    }
  }

  async loadBookingStats() {
    try {
      // Load all bookings to get total
      const allBookings = await this.bookingService.getAllBookingsAdmin({
        limit: 1000
      }).toPromise();

      if (allBookings && allBookings.EC === 0) {
        this.totalBookings = allBookings.total || 0;
        
        // Count by status
        const bookings = allBookings.data || [];
        this.confirmedBookings = bookings.filter((b: any) => b.status === 'confirmed').length;
        this.completedBookings = bookings.filter((b: any) => b.status === 'completed').length;
        this.cancelledBookings = bookings.filter((b: any) => b.status === 'cancelled').length;
        
        // Prepare status distribution data
        this.bookingStatusData = [
          { status: 'pending', count: 0, color: 'bg-yellow-500', label: 'Chờ duyệt' },
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

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('vi-VN').format(num);
  }

  getRevenueBarHeight(revenue: number): string {
    if (!this.revenueChartData.length) return '0%';
    const maxRevenue = Math.max(...this.revenueChartData.map(d => d.revenue));
    if (maxRevenue === 0) return '0%';
    return `${(revenue / maxRevenue) * 100}%`;
  }

  getStatusPercentage(count: number): number {
    if (this.totalBookings === 0) return 0;
    return (count / this.totalBookings) * 100;
  }

  getStatusWidth(count: number): string {
    return `${this.getStatusPercentage(count)}%`;
  }
}
