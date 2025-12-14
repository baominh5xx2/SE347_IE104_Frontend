import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './../config.service';

// Admin Booking List Item (response từ /admin/all và /admin/user/{user_id})
export interface AdminBookingItem {
  booking_id: string;
  user_id: string;
  user_email: string;
  user_full_name: string;
  tour_name: string;
  destination: string;
  start_date: string;
  number_of_people: number;
  total_amount: number;
  status: string;
  created_at: string;
}

// Admin Booking Detail (response từ /admin/{booking_id})
export interface TourPackageInfo {
  package_id: string;
  package_name: string;
  destination: string;
  description: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  price: number;
  image_urls: string;
}

export interface AdminBookingDetail {
  booking_id: string;
  status: string;
  number_of_people: number;
  total_amount: number;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  special_requests: string;
  created_at: string;
  updated_at: string;
  tour_package: TourPackageInfo;
}

// Standard Booking Item (cho các endpoints thông thường)
export interface BookingItem {
  booking_id: string;
  package_id: string;
  user_id: string;
  number_of_people: number;
  total_amount: number;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  special_requests?: string;
  promotion_id?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BookingListParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AdminBookingListResponse {
  EC: number;
  EM: string;
  data: AdminBookingItem[];
  total: number;
}

export interface AdminBookingDetailResponse {
  EC: number;
  EM: string;
  data: AdminBookingDetail;
}

export interface BookingListResponse {
  EC: number;
  EM: string;
  data: BookingItem[];
  total: number;
}

export interface BookingCreateRequest {
  contact_name: string;
  contact_phone: string;
  number_of_people: number;
  package_id: string;
  promotion_code?: string;
  special_requests?: string;
  user_id: string;
}

export interface BookingCreateResponse {
  EC: number;
  EM: string;
  data: BookingItem;
}

export interface BookingDetailResponse {
  EC: number;
  EM: string;
  data: BookingItem;
}

export interface BookingUpdateRequest {
  contact_phone?: string;
  contact_name?: string;
  number_of_people?: number;
  promotion_code?: string;
  special_requests?: string;
  status?: string;
}

export interface BookingUpdateResponse {
  EC: number;
  EM: string;
  data: BookingItem;
}

export interface BookingDeleteResponse {
  EC: number;
  EM: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminBookingService {
  private get apiBaseUrl(): string {
    return this.configService.getApiUrl();
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
   * GET /api/v1/bookings/admin/all
   * Admin: Lấy tất cả bookings trong hệ thống với filters
   */
  getAllBookingsAdmin(params?: BookingListParams): Observable<AdminBookingListResponse> {
    let httpParams = new HttpParams();
    
    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.offset !== undefined) {
      httpParams = httpParams.set('offset', params.offset.toString());
    }

    return this.http.get<AdminBookingListResponse>(
      `${this.apiBaseUrl}/bookings/admin/all`,
      {
        headers: this.getHeaders(),
        params: httpParams
      }
    );
  }

  /**
   * GET /api/v1/bookings/admin/user/{user_id}
   * Admin: Lấy tất cả bookings của 1 user cụ thể
   */
  getUserBookingsAdmin(userId: string, params?: BookingListParams): Observable<AdminBookingListResponse> {
    let httpParams = new HttpParams();
    
    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.offset !== undefined) {
      httpParams = httpParams.set('offset', params.offset.toString());
    }

    return this.http.get<AdminBookingListResponse>(
      `${this.apiBaseUrl}/bookings/admin/user/${userId}`,
      {
        headers: this.getHeaders(),
        params: httpParams
      }
    );
  }

  /**
   * GET /api/v1/bookings/admin/{booking_id}
   * Admin: Lấy chi tiết bất kỳ booking nào với thông tin tour package
   */
  getBookingDetailAdmin(bookingId: string): Observable<AdminBookingDetailResponse> {
    return this.http.get<AdminBookingDetailResponse>(
      `${this.apiBaseUrl}/bookings/admin/${bookingId}`,
      {
        headers: this.getHeaders()
      }
    );
  }

  /**
   * GET /api/v1/bookings/
   * Lấy danh sách bookings với filters (deprecated - dùng getAllBookingsAdmin thay thế)
   * @deprecated Sử dụng getAllBookingsAdmin() hoặc getUserBookingsAdmin() thay thế
   */
  getBookings(params?: BookingListParams): Observable<BookingListResponse> {
    let httpParams = new HttpParams();
    
    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params?.offset !== undefined) {
      httpParams = httpParams.set('offset', params.offset.toString());
    }

    return this.http.get<BookingListResponse>(
      `${this.apiBaseUrl}/bookings/`,
      {
        headers: this.getHeaders(),
        params: httpParams
      }
    );
  }

  /**
   * POST /api/v1/bookings/create-with-otp
   * Tạo booking mới với OTP flow
   */
  createBooking(booking: BookingCreateRequest): Observable<BookingCreateResponse> {
    return this.http.post<BookingCreateResponse>(
      `${this.apiBaseUrl}/bookings/create-with-otp`,
      booking,
      {
        headers: this.getHeaders()
      }
    );
  }

  /**
   * GET /api/v1/bookings/{booking_id}
   * Lấy chi tiết một booking (deprecated - dùng getBookingDetailAdmin thay thế)
   * @deprecated Sử dụng getBookingDetailAdmin() để lấy thêm thông tin tour package
   */
  getBookingById(bookingId: string): Observable<BookingDetailResponse> {
    return this.http.get<BookingDetailResponse>(
      `${this.apiBaseUrl}/bookings/${bookingId}`,
      {
        headers: this.getHeaders()
      }
    );
  }

  /**
   * PUT /api/v1/bookings/{booking_id}
   * Cập nhật booking
   */
  updateBooking(bookingId: string, data: BookingUpdateRequest): Observable<BookingUpdateResponse> {
    return this.http.put<BookingUpdateResponse>(
      `${this.apiBaseUrl}/bookings/${bookingId}`,
      data,
      {
        headers: this.getHeaders()
      }
    );
  }

  /**
   * DELETE /api/v1/bookings/{booking_id}
   * Xóa booking
   */
  deleteBooking(bookingId: string): Observable<BookingDeleteResponse> {
    return this.http.delete<BookingDeleteResponse>(
      `${this.apiBaseUrl}/bookings/${bookingId}`,
      {
        headers: this.getHeaders()
      }
    );
  }
}
