import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  tourName: string;
  destination: string;
  numberOfPeople: number;
  totalAmount: number;
  bookingDate: Date;
  status: 'pending' | 'confirmed' | 'cancelled';
  specialRequests?: string;
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
  currentBooking: Booking | null = null;
  deleteId: string = '';
  editingBooking: Booking | null = null;
  
  // UI states
  isLoading: boolean = false;
  errorMessage: string = '';

  // Stats
  stats = {
    total_bookings: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    total_revenue: 0
  };

  constructor() {}

  ngOnInit() {
    this.loadBookings();
    this.calculateStats();
  }

  async loadBookings() {
    try {
      // TODO: Implement API call
      // const response = await this.bookingService.getBookings();
      // this.bookings = response;
      this.bookings = [];
      this.applyFilters();
    } catch (error) {
      console.error('Error loading bookings:', error);
      this.bookings = [];
      this.applyFilters();
    }
  }

  calculateStats() {
    this.stats.total_bookings = this.bookings.length;
    this.stats.pending = this.bookings.filter(b => b.status === 'pending').length;
    this.stats.confirmed = this.bookings.filter(b => b.status === 'confirmed').length;
    this.stats.cancelled = this.bookings.filter(b => b.status === 'cancelled').length;
    this.stats.total_revenue = this.bookings
      .filter(b => b.status === 'confirmed')
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

  openDetailModal(booking: Booking) {
    this.currentBooking = { ...booking };
    this.showDetailModal = true;
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.currentBooking = null;
  }

  updateStatus(id: string, newStatus: 'pending' | 'confirmed' | 'cancelled') {
    const booking = this.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = newStatus;
      this.calculateStats();
      this.applyFilters();
      this.closeDetailModal();
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

  deleteBooking() {
    if (!this.deleteId) return;
    
    this.bookings = this.bookings.filter(b => b.id !== this.deleteId);
    this.calculateStats();
    this.applyFilters();
    this.closeDeleteModal();
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

  saveBooking() {
    if (!this.editingBooking) return;
    
    const index = this.bookings.findIndex(b => b.id === this.editingBooking!.id);
    if (index !== -1) {
      this.bookings[index] = { ...this.editingBooking };
      this.calculateStats();
      this.applyFilters();
      this.closeEditModal();
      this.closeDetailModal();
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
      'cancelled': 'Đã hủy'
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
}
