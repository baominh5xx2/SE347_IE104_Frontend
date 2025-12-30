import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminBookingService, AdminBookingItem, AdminBookingDetail } from '../../../services/admin/admin-booking.service';
import { AdminUserService } from '../../../services/admin/admin-user.service';
import { AdminTourService } from '../../../services/admin/admin-tour.service';
import { AdminDialogService } from '../../../services/admin/admin-dialog.service';
import { AdminPaymentService } from '../../../services/admin/admin-payment.service';

interface Booking {
  id: string;
  booking_id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  contact_phone?: string;
  contact_email?: string;
  tourName: string;
  destination: string;
  numberOfPeople: number;
  totalAmount: number;
  bookingDate: Date;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'otp_sent';
  specialRequests?: string;
  promotion_code?: string;
  userId?: string;
  userEmail?: string;
}

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss'
})
export class BookingListComponent implements OnInit {
  bookings: Booking[] = [];
  filteredBookings: Booking[] = [];

  // Filters
  searchTerm: string = '';
  statusFilter: string = '';
  phoneFilter: string = '';
  minAmount: number | null = null;
  maxAmount: number | null = null;
  minAmountDisplay: string = '';
  maxAmountDisplay: string = '';
  minPeople: number | null = null;
  maxPeople: number | null = null;
  startDate: string = '';
  endDate: string = '';

  // Modal states
  showDetailModal: boolean = false;
  showDeleteModal: boolean = false;
  showCancelModal: boolean = false;
  showEditModal: boolean = false;
  showAddModal: boolean = false;
  currentBooking: Booking | null = null;
  deleteId: string = '';
  cancelId: string = '';
  editingBooking: Booking | null = null;
  selectedStatusForEdit: Booking['status'] | '' = '';
  newBooking: any = {
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    number_of_people: 1,
    package_id: '',
    special_requests: '',
    user_id: '',
    skip_otp: true
  };

  // Thông tin hiển thị khi nhập ID
  selectedUserInfo: any = null;
  selectedTourInfo: any = null;
  isLoadingUserInfo = false;
  isLoadingTourInfo = false;

  // UI states
  isLoading: boolean = false;
  errorMessage: string = '';

  // Stats
  stats = {
    total_bookings: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
    total_revenue: 0
  };

  constructor(
    private adminBookingService: AdminBookingService,
    private adminUserService: AdminUserService,
    private adminTourService: AdminTourService,
    private dialogService: AdminDialogService,
    private adminPaymentService: AdminPaymentService
  ) { }

  ngOnInit() {
    this.loadBookings();
    this.calculateStats();
  }

  async loadBookings() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const params = {
        status: this.statusFilter || undefined,
        limit: 100,
        offset: 0
      };

      const response = await this.adminBookingService.getAllBookingsAdmin(params).toPromise();

      if (response && response.EC === 0) {
        this.bookings = response.data.map(item => this.mapAdminBookingItemToBooking(item));
        this.stats.total_bookings = response.total;
      } else {
        this.errorMessage = response?.EM || 'Không thể tải danh sách bookings';
        this.bookings = [];
      }

      this.applyFilters();
      this.calculateStats();
    } catch (error: any) {
      console.error('Error loading bookings:', error);
      this.errorMessage = error?.error?.EM || 'Lỗi khi tải danh sách bookings';
      this.bookings = [];
      this.applyFilters();
    } finally {
      this.isLoading = false;
    }
  }

  private mapAdminBookingItemToBooking(item: AdminBookingItem): Booking {
    return {
      id: item.booking_id,
      booking_id: item.booking_id,
      customerName: item.user_full_name,
      customerPhone: '',
      tourName: item.tour_name,
      destination: item.destination,
      numberOfPeople: item.number_of_people,
      totalAmount: item.total_amount,
      bookingDate: new Date(item.created_at),
      status: item.status as 'pending' | 'confirmed' | 'cancelled' | 'completed',
      userId: item.user_id,
      userEmail: item.user_email
    };
  }

  calculateStats() {
    this.stats.total_bookings = this.bookings.length;
    this.stats.pending = this.bookings.filter(b => b.status === 'pending').length;
    this.stats.confirmed = this.bookings.filter(b => b.status === 'confirmed').length;
    this.stats.cancelled = this.bookings.filter(b => b.status === 'cancelled').length;
    this.stats.completed = this.bookings.filter(b => b.status === 'completed').length;
    this.stats.total_revenue = this.bookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + b.totalAmount, 0);
  }

  applyFilters() {
    this.filteredBookings = this.bookings.filter(booking => {
      const matchesSearch = !this.searchTerm ||
        booking.customerName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        booking.customerPhone.includes(this.searchTerm) ||
        booking.tourName.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.statusFilter || booking.status === this.statusFilter;
      const matchesPhone = !this.phoneFilter || booking.customerPhone.includes(this.phoneFilter);
      
      const matchesMinAmount = this.minAmount === null || booking.totalAmount >= this.minAmount;
      const matchesMaxAmount = this.maxAmount === null || booking.totalAmount <= this.maxAmount;
      
      const matchesMinPeople = this.minPeople === null || booking.numberOfPeople >= this.minPeople;
      const matchesMaxPeople = this.maxPeople === null || booking.numberOfPeople <= this.maxPeople;
      
      const matchesStartDate = !this.startDate || new Date(booking.bookingDate) >= new Date(this.startDate);
      const matchesEndDate = !this.endDate || new Date(booking.bookingDate) <= new Date(this.endDate);

      return matchesSearch && matchesStatus && matchesPhone && 
             matchesMinAmount && matchesMaxAmount &&
             matchesMinPeople && matchesMaxPeople &&
             matchesStartDate && matchesEndDate;
    });
  }

  onFilterChange() {
    this.applyFilters();
  }

  formatNumberInput(event: any, type: 'min' | 'max') {
    let value = event.target.value.replace(/\./g, '');
    
    if (value === '') {
      if (type === 'min') {
        this.minAmount = null;
        this.minAmountDisplay = '';
      } else {
        this.maxAmount = null;
        this.maxAmountDisplay = '';
      }
      return;
    }
    
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      const formatted = numValue.toLocaleString('vi-VN');
      if (type === 'min') {
        this.minAmount = numValue;
        this.minAmountDisplay = formatted;
      } else {
        this.maxAmount = numValue;
        this.maxAmountDisplay = formatted;
      }
    }
  }

  async openDetailModal(booking: Booking) {
    this.isLoading = true;
    try {
      // Lấy thông tin chi tiết từ admin API
      const response = await this.adminBookingService.getBookingDetailAdmin(booking.id).toPromise();

      if (response && response.EC === 0) {
        const detail = response.data;
        this.currentBooking = {
          ...booking,
          customerPhone: detail.contact_phone,
          customerName: detail.contact_name,
          customerEmail: detail.contact_email,
          specialRequests: detail.special_requests
        };
        this.showDetailModal = true;
      } else {
        this.errorMessage = response?.EM || 'Không thể tải chi tiết booking';
      }
    } catch (error: any) {
      console.error('Error loading booking detail:', error);
      this.errorMessage = error?.error?.EM || 'Lỗi khi tải chi tiết booking';
    } finally {
      this.isLoading = false;
    }
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.currentBooking = null;
  }

  async updateStatus(id: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed') {
    this.isLoading = true;
    try {
      const response = await this.adminBookingService.updateBooking(id, { status: newStatus }).toPromise();

      if (response && response.EC === 0) {
        // Reload bookings from server to ensure data consistency
        await this.loadBookings();
        this.closeDetailModal();
      } else {
        this.errorMessage = response?.EM || 'Không thể cập nhật trạng thái';
      }
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      this.errorMessage = error?.error?.EM || 'Lỗi khi cập nhật trạng thái';
    } finally {
      this.isLoading = false;
    }
  }

  confirmDelete(bookingId: string) {
    this.deleteId = bookingId;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.deleteId = '';
  }

  confirmCancel(bookingId: string) {
    this.cancelId = bookingId;
    this.showCancelModal = true;
  }

  closeCancelModal() {
    this.showCancelModal = false;
    this.cancelId = '';
  }

  async cancelBooking() {
    if (!this.cancelId) return;

    console.log('🟡 Cancelling booking with ID:', this.cancelId);
    this.isLoading = true;
    try {
      // Workaround: Gọi update status thay vì cancel endpoint vì backend chưa có cancel_booking method
      const response = await this.adminBookingService.updateBooking(this.cancelId, {
        status: 'cancelled'
      }).toPromise();
      console.log('✅ Cancel response:', response);

      if (response && response.EC === 0) {
        console.log('Booking cancelled successfully, updating UI and reloading data');

        // Reload toàn bộ danh sách bookings để đảm bảo dữ liệu mới nhất
        await this.loadBookings();

        this.closeCancelModal();

        // Thông báo thành công qua dialog
        await this.dialogService.alert(
          'Thành công',
          'Đã hủy booking thành công!'
        );
      } else {
        console.error('❌ Cancel failed:', response);
        const errorMsg = response?.EM || 'Không thể hủy booking';
        this.errorMessage = errorMsg;
        this.closeCancelModal();
        await this.dialogService.alert('Lỗi', errorMsg);
      }
    } catch (error: any) {
      console.error('❌ Error cancelling booking:', error);
      const errorMsg = error?.error?.EM || 'Lỗi khi hủy booking';
      this.errorMessage = errorMsg;
      this.closeCancelModal();
      await this.dialogService.alert('Lỗi', errorMsg);
    } finally {
      this.isLoading = false;
    }
  }

  async deleteBooking() {
    if (!this.deleteId) return;

    console.log('🔴 Hard deleting booking with ID:', this.deleteId);
    this.isLoading = true;
    try {
      const response = await this.adminBookingService.deleteBooking(this.deleteId).toPromise();
      console.log('✅ Delete response:', response);

      if (response && response.EC === 0) {
        console.log('Booking deleted successfully, updating UI and reloading data');

        // Reload toàn bộ danh sách bookings để đảm bảo dữ liệu mới nhất
        await this.loadBookings();

        this.closeDeleteModal();

        // Thông báo thành công qua dialog
        await this.dialogService.alert(
          'Thành công',
          'Đã xóa booking thành công!'
        );
      } else {
        console.error('❌ Delete failed:', response);
        const errorMsg = response?.EM || 'Không thể xóa booking';
        this.errorMessage = errorMsg;
        this.closeDeleteModal();
        await this.dialogService.alert('Lỗi', errorMsg);
      }
    } catch (error: any) {
      console.error('❌ Error deleting booking:', error);
      const errorMsg = error?.error?.EM || 'Lỗi khi xóa booking';
      this.errorMessage = errorMsg;
      this.closeDeleteModal();
      await this.dialogService.alert('Lỗi', errorMsg);
    } finally {
      this.isLoading = false;
    }
  }

  async openEditModal(booking: Booking) {
    this.isLoading = true;
    try {
      // Ưu tiên lấy detail để không mất dữ liệu khi lưu lại
      const response = await this.adminBookingService.getBookingDetailAdmin(booking.id).toPromise();
      if (response && response.EC === 0) {
        const detail = response.data;
        this.editingBooking = {
          ...booking,
          customerPhone: detail.contact_phone,
          customerName: detail.contact_name,
          customerEmail: detail.contact_email,
          specialRequests: detail.special_requests,
          numberOfPeople: detail.number_of_people,
          totalAmount: detail.total_amount
        } as Booking;
      } else {
        // Fallback dùng dữ liệu đang có
        this.editingBooking = JSON.parse(JSON.stringify(booking));
      }
      this.selectedStatusForEdit = this.editingBooking ? this.editingBooking.status : '';
      this.showEditModal = true;
    } catch (error) {
      console.error('Error loading booking detail before edit:', error);
      this.editingBooking = JSON.parse(JSON.stringify(booking));
      this.selectedStatusForEdit = this.editingBooking ? this.editingBooking.status : '';
      this.showEditModal = true;
    } finally {
      this.isLoading = false;
    }
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingBooking = null;
    this.selectedStatusForEdit = '';
  }

  async saveBooking() {
    if (!this.editingBooking) return;
    if (!this.selectedStatusForEdit) {
      this.selectedStatusForEdit = this.editingBooking.status;
    }
    const targetStatus = this.selectedStatusForEdit;

    this.isLoading = true;
    try {
      let response;

      // Chuẩn bị dữ liệu cập nhật với tất cả các trường
      const updateData: any = {
        status: targetStatus,
        contact_name: this.editingBooking.customerName,
        contact_phone: this.editingBooking.customerPhone,
        contact_email: this.editingBooking.customerEmail,
        number_of_people: this.editingBooking.numberOfPeople,
        special_requests: this.editingBooking.specialRequests
      };

      if (targetStatus === 'cancelled') {
        // Dùng API cancel khi chuyển sang hủy
        response = await this.adminBookingService.cancelBooking(this.editingBooking.id, {
          reason: 'Admin cập nhật trạng thái sang hủy'
        }).toPromise();
      } else {
        // Các trạng thái khác dùng update với đầy đủ thông tin
        response = await this.adminBookingService.updateBooking(this.editingBooking.id, updateData).toPromise();
      }

      if (response && response.EC === 0) {
        // Reload bookings from server to ensure data consistency
        await this.loadBookings();
        this.closeEditModal();
        this.closeDetailModal();
      } else {
        this.errorMessage = response?.EM || 'Không thể cập nhật booking';
      }
    } catch (error: any) {
      console.error('Error updating booking:', error);
      this.errorMessage = error?.error?.EM || 'Lỗi khi cập nhật booking';
    } finally {
      this.isLoading = false;
    }
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'pending': 'bg-red-100 text-red-800',
      'confirmed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  getPriceColor(status: string): string {
    const colors: { [key: string]: string } = {
      'pending': 'text-red-600',
      'confirmed': 'text-green-600',
      'cancelled': 'text-yellow-600'
    };
    return colors[status] || 'text-gray-600';
  }

  getStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'pending': 'Chờ xử lý',
      'confirmed': 'Đã xác nhận',
      'cancelled': 'Đã hủy',
      'completed': 'Hoàn thành',
      'otp_sent': 'Chờ xác thực OTP'
    };
    return texts[status] || status;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  openAddModal() {
    this.newBooking = {
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      number_of_people: 1,
      package_id: '',
      special_requests: '',
      user_id: ''
    };
    this.selectedUserInfo = null;
    this.selectedTourInfo = null;
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.errorMessage = '';
    this.selectedUserInfo = null;
    this.selectedTourInfo = null;
  }

  // Fetch thông tin user khi nhập user_id
  async onUserIdChange() {
    if (!this.newBooking.user_id || this.newBooking.user_id.trim() === '') {
      this.selectedUserInfo = null;
      return;
    }

    this.isLoadingUserInfo = true;
    try {
      const response = await this.adminUserService.getUserProfile(this.newBooking.user_id).toPromise();
      if (response && response.EC === 0) {
        this.selectedUserInfo = response.data;
        // Auto-fill contact info nếu chưa điền
        if (!this.newBooking.contact_name) {
          this.newBooking.contact_name = this.selectedUserInfo.full_name;
        }
        if (!this.newBooking.contact_phone) {
          this.newBooking.contact_phone = this.selectedUserInfo.phone_number;
        }
        if (!this.newBooking.contact_email) {
          this.newBooking.contact_email = this.selectedUserInfo.email;
        }
      } else {
        this.selectedUserInfo = null;
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      this.selectedUserInfo = null;
    } finally {
      this.isLoadingUserInfo = false;
    }
  }

  // Fetch thông tin tour khi nhập package_id
  async onPackageIdChange() {
    if (!this.newBooking.package_id || this.newBooking.package_id.trim() === '') {
      this.selectedTourInfo = null;
      return;
    }

    this.isLoadingTourInfo = true;
    try {
      const response = await this.adminTourService.getTourPackageById(this.newBooking.package_id);
      if (response && response.EC === 0) {
        this.selectedTourInfo = response.package;
      } else {
        this.selectedTourInfo = null;
      }
    } catch (error) {
      console.error('Error fetching tour info:', error);
      this.selectedTourInfo = null;
    } finally {
      this.isLoadingTourInfo = false;
    }
  }

  async saveNewBooking() {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      console.log('📝 Creating booking:', this.newBooking);
      const response = await this.adminBookingService.createBookingWithOTP(this.newBooking).toPromise();

      console.log('✅ Create booking response:', response);

      if (response && response.EC === 0) {
        // Admin tạo booking thành công - Backend tự động xử lý OTP hoặc skip OTP
        await this.loadBookings();
        this.closeAddModal();
        await this.dialogService.alert(
          'Thành công',
          'Đã tạo booking thành công! Booking ID: ' + response.data.booking_id
        );
      } else {
        this.errorMessage = response?.EM || 'Không thể tạo booking';
      }
    } catch (error: any) {
      console.error('❌ Error creating booking:', error);
      this.errorMessage = error?.error?.EM || 'Lỗi khi tạo booking';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      await this.dialogService.alert('Thành công', 'Đã copy Booking ID vào clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      await this.dialogService.alert('Lỗi', 'Không thể copy vào clipboard');
    }
  }

  /**
   * Process payment for a booking (admin creates payment for user)
   */
  async processPayment(booking: Booking) {
    const confirmed = await this.dialogService.confirm({
      title: 'Xác nhận thanh toán',
      message: `Bạn có muốn thanh toán cho booking "${booking.tourName}" với số tiền ${this.formatPrice(booking.totalAmount)}?`,
      confirmText: 'Thanh toán',
      cancelText: 'Hủy'
    });

    if (!confirmed) return;

    this.isLoading = true;
    try {
      const response = await this.adminPaymentService.createPayment({
        booking_id: booking.id,
        payment_method: 'bank_transfer',
        notes: 'Admin thanh toán cho khách hàng'
      }).toPromise();

      if (response && response.EC === 0) {
        await this.loadBookings();
        await this.dialogService.alert(
          'Thành công',
          'Đã thanh toán thành công! Booking đã được xác nhận.'
        );
      } else {
        await this.dialogService.alert('Lỗi', response?.EM || 'Không thể thanh toán');
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      await this.dialogService.alert('Lỗi', error?.error?.EM || 'Lỗi khi thanh toán');
    } finally {
      this.isLoading = false;
    }
  }
}
