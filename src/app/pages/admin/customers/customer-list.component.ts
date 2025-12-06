import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService, Customer, ChatMessage, ConversationHistory } from '../../../services/customer.service';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-list.component.html',
  styleUrls: ['./customer-list.component.scss']
})
export class CustomerListComponent implements OnInit {
  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  
  // Filters
  searchTerm: string = '';
  statusFilter: string = '';
  sortBy: string = 'created_at';
  
  // Stats
  stats = {
    total_customers: 0,
    active_customers: 0,
    total_bookings: 0,
    total_revenue: 0
  };
  
  // Modal states
  showDetailModal: boolean = false;
  selectedCustomer: Customer | null = null;
  activeTab: 'info' | 'bookings' | 'chat' | 'timeline' = 'info';
  customerConversations: ConversationHistory[] = [];
  selectedConversationId: string = '';
  conversationMessages: ChatMessage[] = [];
  loadingConversation: boolean = false;
  customerBookings: any[] = [];
  timelineActivities: any[] = [];

  constructor(private customerService: CustomerService) {
    console.log('CustomerListComponent constructor called');
  }

  ngOnInit() {
    console.log('CustomerListComponent ngOnInit called');
    // TODO: Load customers from API
    // this.loadCustomers();
    this.calculateStats();
    console.log('Loaded customers:', this.customers.length);
  }

  /**
   * Load customers from API
   */
  async loadCustomers() {
    try {
      // TODO: Implement API call
      // const response = await this.customerService.getCustomers();
      // this.customers = response;
      this.customers = [];
      this.filteredCustomers = [...this.customers];
    } catch (error) {
      console.error('Error loading customers:', error);
      this.customers = [];
      this.filteredCustomers = [];
    }
  }

  /**
   * Calculate statistics
   */
  calculateStats() {
    this.stats.total_customers = this.customers.length;
    this.stats.active_customers = this.customers.filter(c => c.is_activate).length;
    this.stats.total_bookings = this.customers.reduce((sum, c) => sum + (c.total_bookings || 0), 0);
    this.stats.total_revenue = this.customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);
  }

  /**
   * Apply filters
   */
  onFilterChange() {
    this.filteredCustomers = this.customers.filter(customer => {
      const matchesSearch = !this.searchTerm || 
        customer.full_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (customer.phone_number && customer.phone_number.includes(this.searchTerm));
      
      const matchesStatus = !this.statusFilter || 
        (this.statusFilter === 'active' && customer.is_activate) ||
        (this.statusFilter === 'inactive' && !customer.is_activate);
      
      return matchesSearch && matchesStatus;
    });
    
    // Apply sorting
    this.applySorting();
  }

  /**
   * Apply sorting
   */
  applySorting() {
    this.filteredCustomers.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.full_name.localeCompare(b.full_name);
        case 'bookings':
          return (b.total_bookings || 0) - (a.total_bookings || 0);
        case 'spent':
          return (b.total_spent || 0) - (a.total_spent || 0);
        case 'created_at':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }

  /**
   * Open customer detail modal
   */
  async openDetailModal(customer: Customer) {
    this.selectedCustomer = customer;
    this.showDetailModal = true;
    this.activeTab = 'info';
    this.loadCustomerBookings(customer.user_id);
    this.loadCustomerConversations(customer.user_id);
    this.loadTimeline(customer.user_id);
  }

  /**
   * Load customer bookings from API
   */
  async loadCustomerBookings(userId: string) {
    try {
      // TODO: Implement API call
      // const response = await this.customerService.getCustomerBookings(userId);
      // this.customerBookings = response;
      this.customerBookings = [];
    } catch (error) {
      console.error('Error loading bookings:', error);
      this.customerBookings = [];
    }
  }

  /**
   * Load customer conversations from API
   */
  loadCustomerConversations(userId: string) {
    this.customerService.getUserConversations(userId).subscribe({
      next: (response) => {
        this.customerConversations = response || [];
      },
      error: (error) => {
        console.error('Error loading conversations:', error);
        this.customerConversations = [];
      }
    });
  }

  /**
   * Load timeline activities (merged bookings and conversations)
   */
  loadTimeline(userId: string) {
    const activities: any[] = [];
    
    // Add bookings to timeline
    this.customerBookings.forEach(booking => {
      activities.push({
        type: 'booking',
        id: booking.booking_id,
        title: booking.tour_name,
        description: `Đặt tour đi ${booking.destination} - ${booking.number_of_people} người`,
        date: booking.booking_date,
        status: booking.status,
        payment_status: booking.payment_status,
        amount: booking.total_amount,
        icon: 'booking',
        color: this.getTimelineColor('booking', booking.status)
      });
    });
    
    // Add conversations to timeline
    this.customerConversations.forEach((conv, index) => {
      activities.push({
        type: 'conversation',
        id: conv.conversation_id,
        title: `Hội thoại #${index + 1}`,
        description: 'Tư vấn và trao đổi về dịch vụ du lịch',
        date: conv.created_at,
        icon: 'chat',
        color: 'blue'
      });
    });
    
    // Sort by date (newest first)
    this.timelineActivities = activities.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  /**
   * Get timeline color based on activity type and status
   */
  getTimelineColor(type: string, status?: string): string {
    if (type === 'booking') {
      switch (status) {
        case 'confirmed': return 'green';
        case 'pending': return 'red';
        case 'completed': return 'blue';
        case 'cancelled': return 'yellow';
        default: return 'gray';
      }
    }
    return 'blue';
  }

  /**
   * Get timeline icon class
   */
  getTimelineIcon(type: string): string {
    return type === 'booking' ? 'booking' : 'chat';
  }

  /**
   * View activity detail (open respective tab)
   */
  viewActivityDetail(activity: any) {
    if (activity.type === 'booking') {
      this.activeTab = 'bookings';
    } else if (activity.type === 'conversation') {
      this.activeTab = 'chat';
      this.loadConversationMessages(activity.id);
    }
  }

  /**
   * Load conversation messages from API
   */
  loadConversationMessages(conversationId: string) {
    this.selectedConversationId = conversationId;
    this.loadingConversation = true;
    this.conversationMessages = [];
    
    this.customerService.getConversationHistory(conversationId).subscribe({
      next: (history) => {
        this.conversationMessages = history.messages;
        this.loadingConversation = false;
      },
      error: (error) => {
        console.error('Error loading conversation:', error);
        this.loadingConversation = false;
        // Show mock messages if API fails
        this.loadMockConversation(conversationId);
      }
    });
  }

  /**
   * Load mock conversation for demo
   */
  loadMockConversation(conversationId: string) {
    this.conversationMessages = [
      {
        message_id: 'msg_001',
        conversation_id: conversationId,
        user_id: this.selectedCustomer?.user_id || '',
        role: 'user',
        content: 'Tôi muốn tìm tour du lịch Đà Lạt cho gia đình 4 người',
        created_at: '2024-11-28T10:00:00Z'
      },
      {
        message_id: 'msg_002',
        conversation_id: conversationId,
        user_id: 'assistant',
        role: 'assistant',
        content: 'Xin chào! Tôi có thể giúp bạn tìm tour Đà Lạt cho 4 người. Bạn có ngân sách dự kiến và thời gian khởi hành mong muốn không?',
        created_at: '2024-11-28T10:00:15Z'
      },
      {
        message_id: 'msg_003',
        conversation_id: conversationId,
        user_id: this.selectedCustomer?.user_id || '',
        role: 'user',
        content: 'Khoảng 15 triệu, tháng 12 này',
        created_at: '2024-11-28T10:02:00Z'
      },
      {
        message_id: 'msg_004',
        conversation_id: conversationId,
        user_id: 'assistant',
        role: 'assistant',
        content: 'Tôi có một số gói tour phù hợp với ngân sách của bạn:\n\n1. Tour Đà Lạt 3N2Đ - 12,500,000 VNĐ\n2. Tour Đà Lạt Romantic 4N3Đ - 14,800,000 VNĐ\n\nCác tour đều bao gồm khách sạn 4 sao, ăn uống và tham quan các điểm nổi tiếng. Bạn quan tâm tour nào?',
        created_at: '2024-11-28T10:02:30Z'
      }
    ];
  }

  /**
   * Switch tab in modal
   */
  switchTab(tab: 'info' | 'bookings' | 'chat' | 'timeline') {
    this.activeTab = tab;
  }

  /**
   * Get booking status color
   */
  getBookingStatusColor(status: string): string {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Get booking status text
   */
  getBookingStatusText(status: string): string {
    switch (status) {
      case 'confirmed': return 'Đã xác nhận';
      case 'pending': return 'Chờ xử lý';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  }

  /**
   * Get payment status color
   */
  getPaymentStatusColor(status: string): string {
    return status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800';
  }

  /**
   * Get payment status text
   */
  getPaymentStatusText(status: string): string {
    return status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
  }

  /**
   * Close modal
   */
  closeDetailModal() {
    this.showDetailModal = false;
    this.selectedCustomer = null;
    this.activeTab = 'info';
    this.customerConversations = [];
    this.conversationMessages = [];
    this.selectedConversationId = '';
    this.customerBookings = [];
    this.timelineActivities = [];
  }

  /**
   * Get status badge color
   */
  getStatusColor(isActive: boolean): string {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  }

  /**
   * Get status text
   */
  getStatusText(isActive: boolean): string {
    return isActive ? 'Hoạt động' : 'Không hoạt động';
  }

  /**
   * Format price
   */
  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  /**
   * Format date
   */
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format date (short)
   */
  formatDateShort(date: string): string {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(roleId?: string): string {
    if (!roleId) return 'Khách hàng';
    const roles: { [key: string]: string } = {
      'customer': 'Khách hàng',
      'vip': 'Khách VIP',
      'admin': 'Quản trị viên',
      'agent': 'Đại lý'
    };
    return roles[roleId] || roleId;
  }

  /**
   * Get role color class
   */
  getRoleColorClass(roleId?: string): string {
    if (!roleId) return 'bg-gray-100 text-gray-800';
    const colors: { [key: string]: string } = {
      'customer': 'bg-blue-100 text-blue-800',
      'vip': 'bg-purple-100 text-purple-800',
      'admin': 'bg-red-100 text-red-800',
      'agent': 'bg-green-100 text-green-800'
    };
    return colors[roleId] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Get login type display name
   */
  getLoginTypeDisplayName(loginType: string): string {
    const types: { [key: string]: string } = {
      'email': 'Email/Mật khẩu',
      'google': 'Google',
      'facebook': 'Facebook',
      'apple': 'Apple'
    };
    return types[loginType] || loginType;
  }

  /**
   * Get login type icon
   */
  getLoginTypeIcon(loginType: string): string {
    const icons: { [key: string]: string } = {
      'email': 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      'google': 'M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z',
      'facebook': 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
      'apple': 'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z'
    };
    return icons[loginType] || icons['email'];
  }
}
