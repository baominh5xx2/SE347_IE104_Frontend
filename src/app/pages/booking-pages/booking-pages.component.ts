import { Component, OnInit } from '@angular/core';
import { BookingCardComponent } from '../../components/booking-card/booking-card.component';
import { FormsModule } from '@angular/forms';
import { CancellationPolicyComponent } from '../../components/cancellation-policy/cancellation-policy.component';
import { Router, ActivatedRoute } from '@angular/router';
import { BookingService } from '../../services/booking.service';
import { TourService } from '../../services/tour.service';
import { AuthStateService } from '../../services/auth-state.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-booking-pages',
  imports: [
    BookingCardComponent,
    CancellationPolicyComponent,
    FormsModule,
    CommonModule],
  templateUrl: './booking-pages.component.html',
  styleUrl: './booking-pages.component.scss'
})
export class BookingPagesComponent implements OnInit {
  packageId: string = '';
  tourPackage: any = null;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  fullName: string = '';
  email: string = '';
  phoneNumber: string = '';
  numberOfPeople: number = 1;
  specialRequests: string = '';
  isSameAsBooker: boolean = true;

  currentUser: any = null;

  priceBreakdown: PriceBreakdown = {
    roomDescription: '',
    roomPrice: 0,
    taxAndFees: 0,
    totalPrice: 0,
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private bookingService: BookingService,
    private tourService: TourService,
    private authStateService: AuthStateService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.packageId = params['id'];
      if (this.packageId) {
        this.loadTourPackage();
      }
    });

    this.authStateService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.fullName = user.full_name || '';
        this.email = user.email || '';
      }
    });
  }

  async loadTourPackage(): Promise<void> {
    try {
      this.isLoading = true;
      const response = await this.tourService.getTourPackageById(this.packageId);
      if (response.EC === 0 && response.package) {
        this.tourPackage = response.package;
        this.updatePriceBreakdown();
      } else {
        this.errorMessage = response.EM || 'Không thể tải thông tin tour';
      }
    } catch (error: any) {
      console.error('Error loading tour package:', error);
      this.errorMessage = error.message || 'Không thể tải thông tin tour';
    } finally {
      this.isLoading = false;
    }
  }

  updatePriceBreakdown(): void {
    if (this.tourPackage) {
      const basePrice = this.tourPackage.price || 0;
      const totalPrice = basePrice * this.numberOfPeople;
      
      this.priceBreakdown = {
        roomDescription: `${this.tourPackage.package_name} - ${this.numberOfPeople} người`,
        roomPrice: totalPrice,
        taxAndFees: 0,
        totalPrice: totalPrice,
      };
    }
  }

  onNumberOfPeopleChange(): void {
    this.updatePriceBreakdown();
  }

  submitForm() {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.currentUser || !this.currentUser.user_id) {
      this.errorMessage = 'Vui lòng đăng nhập để đặt tour';
      this.isLoading = false;
      return;
    }

    const bookingData = {
      package_id: this.packageId,
      number_of_people: this.numberOfPeople,
      contact_name: this.fullName,
      contact_phone: this.phoneNumber,
      user_id: this.currentUser.user_id,
      special_requests: this.specialRequests || undefined
    };

    this.bookingService.createBooking(bookingData).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.successMessage = 'Đặt tour thành công! Đang chuyển đến trang đơn hàng của bạn...';
          this.errorMessage = '';
          this.isLoading = false;
          
          setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 100);
          
          setTimeout(() => {
            this.router.navigate(['/my-bookings']);
          }, 3000);
        } else {
          this.errorMessage = response.EM || 'Không thể tạo đơn đặt tour';
          this.successMessage = '';
          this.isLoading = false;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },
      error: (error) => {
        console.error('Error creating booking:', error);
        this.errorMessage = 'Có lỗi xảy ra khi tạo đơn đặt tour. Vui lòng thử lại sau.';
        this.successMessage = '';
        this.isLoading = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  validateForm(): boolean {
    if (!this.fullName.trim()) {
      this.errorMessage = 'Vui lòng nhập họ và tên';
      return false;
    }
    if (!this.email.trim()) {
      this.errorMessage = 'Vui lòng nhập email';
      return false;
    }
    if (!this.phoneNumber.trim()) {
      this.errorMessage = 'Vui lòng nhập số điện thoại';
      return false;
    }
    if (this.numberOfPeople < 1) {
      this.errorMessage = 'Số người phải lớn hơn 0';
      return false;
    }
    return true;
  }

  proceedToPayment() {
    this.submitForm();
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }
}

interface PriceBreakdown {
  roomDescription: string;
  roomPrice: number;
  taxAndFees: number;
  totalPrice: number;
}

