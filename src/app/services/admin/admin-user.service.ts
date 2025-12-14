import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './../config.service';

// User Profile
export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string;
  phone_number: string;
  profile_picture?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfileResponse {
  EC: number;
  EM: string;
  data: UserProfile;
}

// User Bookings
export interface UserBooking {
  booking_id: string;
  package_id: string;
  package_name: string;
  user_id: string;
  start_date: string;
  end_date: string;
  number_of_people: number;
  total_price: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface UserBookingsResponse {
  EC: number;
  EM: string;
  data: {
    items: UserBooking[];
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// User Status Update
export interface UpdateStatusRequest {
  is_active: boolean;
  reason?: string;
}

export interface UpdateStatusResponse {
  EC: number;
  EM: string;
  data: {
    user_id: string;
    is_active: boolean;
  };
}

// User Summary
export interface UserKPI {
  total_bookings: number;
  pending_bookings: number;
  confirmed_bookings: number;
  completed_tours: number;
  cancelled_bookings: number;
  total_paid_amount: number;
  currency: string;
}

export interface RecentBooking {
  booking_id: string;
  package_id: string;
  package_name: string;
  status: string;
  total_price: number;
  created_at: string;
}

export interface RecentPayment {
  payment_id: string;
  amount: number;
  status: string;
  paid_at: string;
}

export interface UserSummaryResponse {
  EC: number;
  EM: string;
  data: {
    user: UserProfile;
    kpi: UserKPI;
    recent: {
      recent_bookings: RecentBooking[];
      recent_payments: RecentPayment[];
    };
  };
}

// Chat History
export interface ChatMessage {
  message_id: string;
  role: string;
  content: string;
  intent?: string;
  created_at: string;
}

export interface ChatRoom {
  room_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages: ChatMessage[];
}

export interface ChatHistoryResponse {
  EC: number;
  EM: string;
  data: {
    user_id: string;
    total_rooms: number;
    rooms: ChatRoom[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {
  private get apiBaseUrl(): string {
    return `${this.configService.getApiUrl()}/admin/users`;
  }

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  /**
   * GET /api/v1/admin/users/{user_id}
   * Get user profile by ID
   */
  getUserProfile(userId: string): Observable<UserProfileResponse> {
    return this.http.get<UserProfileResponse>(
      `${this.apiBaseUrl}/${userId}`,
      { headers: this.getHeaders() }
    );
  }

  /**
   * GET /api/v1/admin/users/{user_id}/bookings
   * Get user bookings with pagination and filters
   */
  getUserBookings(
    userId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
      from_date?: string;
      to_date?: string;
      sort?: string;
    }
  ): Observable<UserBookingsResponse> {
    let httpParams = new HttpParams();
    
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.from_date) httpParams = httpParams.set('from_date', params.from_date);
    if (params?.to_date) httpParams = httpParams.set('to_date', params.to_date);
    if (params?.sort) httpParams = httpParams.set('sort', params.sort);

    return this.http.get<UserBookingsResponse>(
      `${this.apiBaseUrl}/${userId}/bookings`,
      {
        headers: this.getHeaders(),
        params: httpParams
      }
    );
  }

  /**
   * PATCH /api/v1/admin/users/{user_id}/status
   * Update user active status
   */
  updateUserStatus(userId: string, request: UpdateStatusRequest): Observable<UpdateStatusResponse> {
    return this.http.patch<UpdateStatusResponse>(
      `${this.apiBaseUrl}/${userId}/status`,
      request,
      { headers: this.getHeaders() }
    );
  }

  /**
   * GET /api/v1/admin/users/{user_id}/summary
   * Get comprehensive user summary with KPIs and recent activities
   */
  getUserSummary(
    userId: string,
    params?: {
      from_date?: string;
      to_date?: string;
    }
  ): Observable<UserSummaryResponse> {
    let httpParams = new HttpParams();
    
    if (params?.from_date) httpParams = httpParams.set('from_date', params.from_date);
    if (params?.to_date) httpParams = httpParams.set('to_date', params.to_date);

    return this.http.get<UserSummaryResponse>(
      `${this.apiBaseUrl}/${userId}/summary`,
      {
        headers: this.getHeaders(),
        params: httpParams
      }
    );
  }

  /**
   * GET /api/v1/admin/users/{user_id}/chat-history
   * Get user's chat history grouped by chat rooms
   */
  getUserChatHistory(userId: string): Observable<ChatHistoryResponse> {
    return this.http.get<ChatHistoryResponse>(
      `${this.apiBaseUrl}/${userId}/chat-history`,
      { headers: this.getHeaders() }
    );
  }
}
