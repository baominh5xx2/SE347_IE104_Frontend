import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService, RevenuePeriod, PriceRangeData } from '../../../services/admin/admin-report.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {
  // Revenue Report
  revenuePeriodType: 'week' | 'month' = 'month';
  revenueNumPeriods: number = 12;
  revenueData: RevenuePeriod[] = [];
  totalRevenue: number = 0;
  totalBookings: number = 0;
  isLoadingRevenue: boolean = false;

  // People by Price Range
  priceRangePeriodType: 'week' | 'month' = 'week';
  priceRangeTargetDate: string = '';
  priceRangeData: PriceRangeData[] = [];
  totalPeople: number = 0;
  totalBookingsPriceRange: number = 0;
  periodStart: string = '';
  periodEnd: string = '';
  isLoadingPriceRange: boolean = false;

  errorMessage: string = '';

  constructor(private reportService: ReportService) {}

  ngOnInit() {
    this.loadRevenueReport();
    this.loadPriceRangeReport();
  }

  loadRevenueReport() {
    this.isLoadingRevenue = true;
    this.errorMessage = '';

    console.log('📈 Loading revenue report...');
    console.log('📈 Period type:', this.revenuePeriodType, 'Num periods:', this.revenueNumPeriods);

    this.reportService.getRevenueReport({
      period_type: this.revenuePeriodType,
      num_periods: this.revenueNumPeriods
    }).subscribe({
      next: (response) => {
        console.log('📈 Revenue report API response:', response);
        if (response.EC === 0) {
          this.revenueData = (response.data || []).map(item => ({
            period: this.formatPeriodToMonth(item.period || ''),
            revenue: item.revenue || 0,
            bookings: item.bookings || 0
          }));
          this.totalRevenue = response.total_revenue || 0;
          this.totalBookings = response.total_bookings || 0;
          
          console.log('📈 Processed revenue data:', this.revenueData);
          console.log('📈 Total:', this.totalRevenue, 'Bookings:', this.totalBookings);
        } else {
          console.error('❌ Revenue report API error:', response.EM);
          this.errorMessage = response.EM || 'Không thể tải báo cáo doanh thu';
          this.revenueData = [];
          this.totalRevenue = 0;
          this.totalBookings = 0;
        }
        this.isLoadingRevenue = false;
      },
      error: (error) => {
        console.error('❌ Error loading revenue report:', error);
        this.errorMessage = 'Lỗi khi tải báo cáo doanh thu';
        this.revenueData = [];
        this.totalRevenue = 0;
        this.totalBookings = 0;
        this.isLoadingRevenue = false;
      }
    });
  }

  loadPriceRangeReport() {
    this.isLoadingPriceRange = true;
    this.errorMessage = '';

    this.reportService.getPeopleByPriceRange({
      period_type: this.priceRangePeriodType,
      target_date: this.priceRangeTargetDate || undefined
    }).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.priceRangeData = response.data || [];
          this.totalPeople = response.total_people_all_ranges || 0;
          this.totalBookingsPriceRange = response.total_bookings_all_ranges || 0;
          this.periodStart = response.period_start || '';
          this.periodEnd = response.period_end || '';
        } else {
          this.errorMessage = response.EM || 'Không thể tải báo cáo phân khúc giá';
        }
        this.isLoadingPriceRange = false;
      },
      error: (error) => {
        console.error('Error loading price range report:', error);
        this.errorMessage = 'Lỗi khi tải báo cáo phân khúc giá';
        this.isLoadingPriceRange = false;
      }
    });
  }

  onRevenuePeriodChange() {
    this.loadRevenueReport();
  }

  onRevenuePeriodsChange() {
    this.loadRevenueReport();
  }

  onPriceRangePeriodChange() {
    this.loadPriceRangeReport();
  }

  onPriceRangeDateChange() {
    this.loadPriceRangeReport();
  }

  formatPrice(price: number): string {
    if (price === null || price === undefined || isNaN(price)) {
      return '0 VNĐ';
    }
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
  }

  formatDate(date: string): string {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('vi-VN');
    } catch {
      return date;
    }
  }

  getPriceRangeLabel(range: string): string {
    const labels: { [key: string]: string } = {
      'budget': 'Tiết kiệm',
      'medium': 'Trung bình',
      'premium': 'Cao cấp'
    };
    return labels[range] || range;
  }

  getPriceRangeColor(range: string): string {
    const colors: { [key: string]: string } = {
      'budget': 'bg-blue-100 text-blue-800',
      'medium': 'bg-green-100 text-green-800',
      'premium': 'bg-purple-100 text-purple-800'
    };
    return colors[range] || 'bg-gray-100 text-gray-800';
  }

  getPriceRangePercentage(people: number): number {
    return this.totalPeople > 0 ? (people / this.totalPeople) * 100 : 0;
  }

  getRevenueMax(): number {
    if (this.revenueData.length === 0) return 0;
    return Math.max(...this.revenueData.map(d => d.revenue));
  }

  getRevenueBarHeight(revenue: number): string {
    if (revenue === null || revenue === undefined || isNaN(revenue)) return '20px';
    const max = this.getRevenueMax();
    if (max === 0) return '20px';
    
    const percentage = (revenue / max) * 100;
    // Minimum 20px height for visibility
    const minHeight = 20;
    const calculatedHeight = Math.max(minHeight, (percentage / 100) * 256); // 256px = max height
    return `${Math.min(256, calculatedHeight)}px`;
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
      return `Tháng ${month}/${year}`;
    }
    return period;
  }
}
