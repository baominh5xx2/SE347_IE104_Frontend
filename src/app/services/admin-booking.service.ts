import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface BookingItem {
  booking_id: string;
  package_id: string;
  user_id: string;
  number_of_people: number;
  total_amount: number;
  contact_name: string;
  contact_phone: string;
  special_requests?: string;
  promotion_id?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BookingListParams {
  user_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
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
   * GET /api/v1/bookings/
   * Lấy danh sách bookings với filters
   */
  getBookings(params?: BookingListParams): Observable<BookingListResponse> {
    let httpParams = new HttpParams();
    
    if (params?.user_id) {
      httpParams = httpParams.set('user_id', params.user_id);
    }
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
   * POST /api/v1/bookings/
   * Tạo booking mới (Admin tạo với status confirmed)
   */
  createBooking(booking: BookingCreateRequest): Observable<BookingCreateResponse> {
    return this.http.post<BookingCreateResponse>(
      `${this.apiBaseUrl}/bookings/`,
      booking,
      {
        headers: this.getHeaders()
      }
    );
  }

  /**
   * GET /api/v1/bookings/{booking_id}
   * Lấy chi tiết một booking
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
