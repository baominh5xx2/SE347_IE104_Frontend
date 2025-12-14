import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  AdminBookingService, 
  BookingItem, 
  BookingCreateRequest, 
  BookingUpdateRequest 
} from '../../../services/admin-booking.service';

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss'
})
export class BookingListComponent implements OnInit {
  bookings: BookingItem[] = [];
  filteredBookings: BookingItem[] = [];
  
  // Filters
  searchTerm = '';
  statusFilter = '';
  userIdFilter = '';
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalBookings = 0;
  
  // Modals
  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;
  
  // Forms
  newBooking: Partial<BookingCreateRequest> = {};
  editBooking: Partial<BookingUpdateRequest> = {};
  editId = '';
  deleteId = '';
  
  // UI State
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  
  // Status options
  statusOptions = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'pending', label: 'Chờ xác nhận' },
    { value: 'confirmed', label: 'Đã xác nhận' },
    { value: 'cancelled', label: 'Đã hủy' },
    { value: 'completed', label: 'Hoàn thành' }
  ];

  constructor(private bookingService: AdminBookingService) {}

  ngOnInit() {
    this.loadBookings();
  }

  loadBookings() {
    this.isLoading = true;
    this.errorMessage = '';
    
    const params: any = {
      limit: this.itemsPerPage,
      offset: (this.currentPage - 1) * this.itemsPerPage
    };
    
    if (this.statusFilter) {
      params.status = this.statusFilter;
    }
    if (this.userIdFilter) {
      params.user_id = this.userIdFilter;
    }
    
    this.bookingService.getBookings(params).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.bookings = response.data || [];
          this.totalBookings = response.total || 0;
          this.applyClientFilters();
        } else {
          this.errorMessage = response.EM || 'Không thể tải danh sách bookings';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Lỗi khi tải danh sách bookings';
        console.error('Load bookings error:', error);
        this.isLoading = false;
      }
    });
  }

  applyClientFilters() {
    this.filteredBookings = this.bookings.filter(booking => {
      if (!this.searchTerm) return true;
      
      const search = this.searchTerm.toLowerCase();
      return (
        booking.contact_name.toLowerCase().includes(search) ||
        booking.contact_phone.includes(search) ||
        booking.booking_id.toLowerCase().includes(search)
      );
    });
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadBookings();
  }

  clearFilters() {
    this.searchTerm = '';
    this.statusFilter = '';
    this.userIdFilter = '';
    this.currentPage = 1;
    this.loadBookings();
  }

  // Add Modal
  openAddModal() {
    this.newBooking = {
      contact_name: '',
      contact_phone: '',
      number_of_people: 1,
      package_id: '',
      user_id: '',
      special_requests: ''
    };
    this.showAddModal = true;
    this.errorMessage = '';
  }

  closeAddModal() {
    this.showAddModal = false;
    this.newBooking = {};
  }

  saveBooking() {
    if (!this.validateNewBooking()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    
    const data: BookingCreateRequest = {
      contact_name: this.newBooking.contact_name!,
      contact_phone: this.newBooking.contact_phone!,
      number_of_people: this.newBooking.number_of_people!,
      package_id: this.newBooking.package_id!,
      user_id: this.newBooking.user_id!,
      special_requests: this.newBooking.special_requests,
      promotion_code: this.newBooking.promotion_code
    };
    
    this.bookingService.createBooking(data).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.successMessage = 'Tạo booking thành công';
          this.loadBookings();
          this.closeAddModal();
          setTimeout(() => this.successMessage = '', 3000);
        } else {
          this.errorMessage = response.EM || 'Không thể tạo booking';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.EM || 'Lỗi khi tạo booking';
        console.error('Create booking error:', error);
        this.isLoading = false;
      }
    });
  }

  // Edit Modal
  openEditModal(booking: BookingItem) {
    this.editId = booking.booking_id;
    this.editBooking = {
      contact_name: booking.contact_name,
      contact_phone: booking.contact_phone,
      number_of_people: booking.number_of_people,
      status: booking.status,
      special_requests: booking.special_requests || ''
    };
    this.showEditModal = true;
    this.errorMessage = '';
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editBooking = {};
    this.editId = '';
  }

  updateBooking() {
    if (!this.validateEditBooking()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    
    this.bookingService.updateBooking(this.editId, this.editBooking).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.successMessage = 'Cập nhật booking thành công';
          this.loadBookings();
          this.closeEditModal();
          setTimeout(() => this.successMessage = '', 3000);
        } else {
          this.errorMessage = response.EM || 'Không thể cập nhật booking';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.EM || 'Lỗi khi cập nhật booking';
        console.error('Update booking error:', error);
        this.isLoading = false;
      }
    });
  }

  // Delete Modal
  confirmDelete(bookingId: string) {
    this.deleteId = bookingId;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.deleteId = '';
  }

  deleteBooking() {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.bookingService.deleteBooking(this.deleteId).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.successMessage = 'Xóa booking thành công';
          this.loadBookings();
          this.closeDeleteModal();
          setTimeout(() => this.successMessage = '', 3000);
        } else {
          this.errorMessage = response.EM || 'Không thể xóa booking';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = error.error?.EM || 'Lỗi khi xóa booking';
        console.error('Delete booking error:', error);
        this.isLoading = false;
        this.closeDeleteModal();
      }
    });
  }

  // Validation
  validateNewBooking(): boolean {
    if (!this.newBooking.contact_name?.trim()) {
      this.errorMessage = 'Vui lòng nhập tên liên hệ';
      return false;
    }
    if (!this.newBooking.contact_phone?.trim()) {
      this.errorMessage = 'Vui lòng nhập số điện thoại';
      return false;
    }
    if (!this.newBooking.package_id?.trim()) {
      this.errorMessage = 'Vui lòng nhập Package ID';
      return false;
    }
    if (!this.newBooking.user_id?.trim()) {
      this.errorMessage = 'Vui lòng nhập User ID';
      return false;
    }
    if (!this.newBooking.number_of_people || this.newBooking.number_of_people < 1) {
      this.errorMessage = 'Số người phải lớn hơn 0';
      return false;
    }
    return true;
  }

  validateEditBooking(): boolean {
    if (!this.editBooking.contact_name?.trim()) {
      this.errorMessage = 'Vui lòng nhập tên liên hệ';
      return false;
    }
    if (!this.editBooking.contact_phone?.trim()) {
      this.errorMessage = 'Vui lòng nhập số điện thoại';
      return false;
    }
    if (!this.editBooking.number_of_people || this.editBooking.number_of_people < 1) {
      this.errorMessage = 'Số người phải lớn hơn 0';
      return false;
    }
    return true;
  }

  // Pagination
  get totalPages(): number {
    return Math.ceil(this.totalBookings / this.itemsPerPage);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadBookings();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPages = Math.min(this.totalPages, 5);
    for (let i = 1; i <= maxPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Utilities
  getStatusLabel(status: string): string {
    const option = this.statusOptions.find(opt => opt.value === status);
    return option ? option.label : status;
  }

  getStatusClass(status: string): string {
    const classes: any = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'completed': 'bg-blue-100 text-blue-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('vi-VN');
  }

  Math = Math;
}
