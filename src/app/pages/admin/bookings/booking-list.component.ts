import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminBookingService, AdminBookingItem, AdminBookingDetail } from '../../../services/admin/admin-booking.service';
import { AdminUserService } from '../../../services/admin/admin-user.service';
import { AdminTourService } from '../../../services/admin/admin-tour.service';

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  tourName: string;
  destination: string;
  numberOfPeople: number;
  totalAmount: number;
  bookingDate: Date;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  specialRequests?: string;
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
  
  // Modal states
  showDetailModal: boolean = false;
  showDeleteModal: boolean = false;
  showEditModal: boolean = false;
  showAddModal: boolean = false;
  currentBooking: Booking | null = null;
  deleteId: string = '';
  editingBooking: Booking | null = null;
  newBooking: any = {
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    number_of_people: 1,
    package_id: '',
    special_requests: '',
    user_id: ''
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
    private adminTourService: AdminTourService
  ) {}

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
      customerName: item.user_full_name,
      customerPhone: '', // Không có trong AdminBookingItem
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
      
      return matchesSearch && matchesStatus && matchesPhone;
    });
  }

  onFilterChange() {
    this.applyFilters();
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
        const booking = this.bookings.find(b => b.id === id);
        if (booking) {
          booking.status = newStatus;
          this.calculateStats();
          this.applyFilters();
        }
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

  async deleteBooking() {
    if (!this.deleteId) return;
    
    this.isLoading = true;
    try {
      const response = await this.adminBookingService.deleteBooking(this.deleteId).toPromise();
      
      if (response && response.EC === 0) {
        this.bookings = this.bookings.filter(b => b.id !== this.deleteId);
        this.calculateStats();
        this.applyFilters();
        this.closeDeleteModal();
      } else {
        this.errorMessage = response?.EM || 'Không thể xóa booking';
        this.closeDeleteModal();
      }
    } catch (error: any) {
      console.error('Error deleting booking:', error);
      this.errorMessage = error?.error?.EM || 'Lỗi khi xóa booking';
      this.closeDeleteModal();
    } finally {
      this.isLoading = false;
    }
  }

  openEditModal(booking: Booking) {
    // Create a deep copy to avoid modifying original data while editing
    this.editingBooking = JSON.parse(JSON.stringify(booking));
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editingBooking = null;
  }

  async saveBooking() {
    if (!this.editingBooking) return;
    
    this.isLoading = true;
    try {
      const updateData = {
        number_of_people: this.editingBooking.numberOfPeople,
        status: this.editingBooking.status,
        contact_phone: this.editingBooking.customerPhone
      };
      
      const response = await this.adminBookingService.updateBooking(this.editingBooking.id, updateData).toPromise();
      
      if (response && response.EC === 0) {
        const index = this.bookings.findIndex(b => b.id === this.editingBooking!.id);
        if (index !== -1) {
          this.bookings[index] = { ...this.editingBooking };
          this.calculateStats();
          this.applyFilters();
        }
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
      const response = await this.adminBookingService.createBooking(this.newBooking).toPromise();
      
      if (response && response.EC === 0) {
        await this.loadBookings();
        this.closeAddModal();
      } else {
        this.errorMessage = response?.EM || 'Không thể tạo booking';
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      this.errorMessage = error?.error?.EM || 'Lỗi khi tạo booking';
    } finally {
      this.isLoading = false;
    }
  }
}
