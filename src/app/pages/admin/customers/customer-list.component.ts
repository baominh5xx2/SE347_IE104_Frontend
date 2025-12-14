import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminUserService, UserProfile, ChatRoom } from '../../../services/admin/admin-user.service';

interface UserData {
  profile: UserProfile;
  summary: {
    total_bookings: number;
    pending_bookings: number;
    confirmed_bookings: number;
    completed_tours: number;
    cancelled_bookings: number;
    total_paid_amount: number;
  };
  bookings: any[];
  chatRooms: ChatRoom[];
}

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-list.component.html',
  styleUrls: ['./customer-list.component.scss']
})
export class CustomerListComponent implements OnInit {
  // Search
  searchUserId: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';
  
  // User data
  userData: UserData | null = null;
  
  // Modal
  showDetailModal: boolean = false;
  activeTab: 'info' | 'bookings' | 'chat' | 'timeline' = 'info';
  
  // Chat
  selectedRoomId: string = '';
  selectedRoom: ChatRoom | null = null;
  
  // Bookings pagination
  bookingsPage: number = 1;
  bookingsLimit: number = 10;
  totalBookings: number = 0;
  
  // Timeline activities
  timelineActivities: any[] = [];

  constructor(private adminUserService: AdminUserService) {}

  ngOnInit() {}

  /**
   * Search user by user_id
   */
  async searchUser() {
    if (!this.searchUserId.trim()) {
      this.errorMessage = 'Vui lòng nhập User ID';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.userData = null;

    try {
      // Get user summary (includes profile + KPIs)
      const summaryResponse = await this.adminUserService.getUserSummary(this.searchUserId).toPromise();
      
      if (summaryResponse?.EC !== 0 || !summaryResponse?.data) {
        this.errorMessage = summaryResponse?.EM || 'Không tìm thấy user';
        this.isLoading = false;
        return;
      }

      const profile = summaryResponse.data.user;
      const summary = summaryResponse.data.kpi || {
        total_bookings: 0,
        pending_bookings: 0,
        confirmed_bookings: 0,
        completed_tours: 0,
        cancelled_bookings: 0,
        total_paid_amount: 0
      };

      // Get bookings
      const bookingsResponse = await this.adminUserService.getUserBookings(this.searchUserId, {
        page: 1,
        limit: 50,
        sort: 'created_at_desc'
      }).toPromise();
      const bookings = bookingsResponse?.data?.items || [];

      // Get chat history
      const chatResponse = await this.adminUserService.getUserChatHistory(this.searchUserId).toPromise();
      const chatRooms = chatResponse?.data?.rooms || [];

      // Set user data
      this.userData = {
        profile,
        summary,
        bookings,
        chatRooms
      };

      // Open detail modal
      this.showDetailModal = true;
      this.activeTab = 'info';
      this.loadTimeline();

    } catch (error: any) {
      console.error('Error searching user:', error);
      this.errorMessage = error?.error?.EM || 'Lỗi khi tìm kiếm user';
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load timeline activities
   */
  loadTimeline() {
    if (!this.userData) return;

    const activities: any[] = [];

    // Add bookings
    this.userData.bookings.forEach(booking => {
      activities.push({
        type: 'booking',
        id: booking.booking_id,
        title: booking.package_name || 'Tour booking',
        description: `${booking.number_of_people} người - ${this.formatPrice(booking.total_amount)}`,
        date: booking.created_at,
        status: booking.status,
        icon: 'booking',
        color: this.getBookingColor(booking.status)
      });
    });

    // Add chat rooms
    this.userData.chatRooms.forEach((room, index) => {
      activities.push({
        type: 'chat',
        id: room.room_id,
        title: room.title || `Hội thoại #${index + 1}`,
        description: `${room.message_count} tin nhắn`,
        date: room.created_at,
        icon: 'chat',
        color: 'blue'
      });
    });

    // Sort by date
    this.timelineActivities = activities.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  /**
   * View chat room messages
   */
  viewChatRoom(roomId: string) {
    const room = this.userData?.chatRooms.find(r => r.room_id === roomId);
    if (room) {
      this.selectedRoomId = roomId;
      this.selectedRoom = room;
      this.activeTab = 'chat';
    }
  }

  /**
   * Toggle user status
   */
  toggleUserStatus() {
    if (!this.userData) return;

    const currentStatus = this.userData.profile.is_active;
    const newStatus = !currentStatus;
    const reason = newStatus ? 'Activated by admin' : 'Deactivated by admin';

    this.adminUserService.updateUserStatus(this.userData.profile.user_id, {
      is_active: newStatus,
      reason: reason
    }).subscribe({
      next: (response) => {
        if (response.EC === 0 && this.userData) {
          this.userData.profile.is_active = newStatus;
          alert(`Đã ${newStatus ? 'kích hoạt' : 'vô hiệu hóa'} user thành công`);
        }
      },
      error: (error) => {
        console.error('Error updating status:', error);
        alert('Không thể cập nhật trạng thái user');
      }
    });
  }

  /**
   * Close modal
   */
  closeDetailModal() {
    this.showDetailModal = false;
    this.userData = null;
    this.activeTab = 'info';
    this.selectedRoomId = '';
    this.selectedRoom = null;
    this.timelineActivities = [];
  }

  /**
   * Switch tab
   */
  switchTab(tab: 'info' | 'bookings' | 'chat' | 'timeline') {
    this.activeTab = tab;
  }

  /**
   * View activity detail
   */
  viewActivity(activity: any) {
    if (activity.type === 'booking') {
      this.activeTab = 'bookings';
    } else if (activity.type === 'chat') {
      this.viewChatRoom(activity.id);
    }
  }

  // Utility methods
  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateShort(date: string): string {
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getStatusColor(isActive: boolean): string {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Hoạt động' : 'Không hoạt động';
  }

  getBookingColor(status: string): string {
    const colors: { [key: string]: string } = {
      'confirmed': 'green',
      'pending': 'yellow',
      'completed': 'blue',
      'cancelled': 'red'
    };
    return colors[status] || 'gray';
  }

  getBookingStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'confirmed': 'bg-green-100 text-green-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-blue-100 text-blue-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  getBookingStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'confirmed': 'Đã xác nhận',
      'pending': 'Chờ xử lý',
      'completed': 'Hoàn thành',
      'cancelled': 'Đã hủy'
    };
    return texts[status] || status;
  }

  getPaymentStatusColor(status: string): string {
    return status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800';
  }

  getPaymentStatusText(status: string): string {
    return status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
  }

  getRoleDisplayName(roleId?: string): string {
    const roles: { [key: string]: string } = {
      'customer': 'Khách hàng',
      'admin': 'Quản trị viên'
    };
    return roles[roleId || ''] || 'Người dùng';
  }

  getRoleColorClass(roleId?: string): string {
    const colors: { [key: string]: string } = {
      'customer': 'bg-blue-100 text-blue-800',
      'admin': 'bg-red-100 text-red-800'
    };
    return colors[roleId || ''] || 'bg-gray-100 text-gray-800';
  }

  getLoginTypeDisplayName(loginType: string): string {
    const types: { [key: string]: string } = {
      'email': 'Email/Mật khẩu',
      'google': 'Google',
      'facebook': 'Facebook',
      'apple': 'Apple'
    };
    return types[loginType] || loginType;
  }

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
