import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface Review {
  review_id: string;
  booking_id: string;
  user_id: string;
  package_id: string;
  rating: number;
  comment?: string;
  is_approved: boolean;
  created_at: string;
  updated_at?: string;
  package_name?: string;
  destination?: string;
}

export interface ReviewCreate {
  booking_id: string;
  package_id: string;
  rating: number;
  comment?: string;
}

export interface ReviewUpdate {
  rating?: number;
  comment?: string;
}

export interface ReviewResponse {
  EC: number;
  EM: string;
  data?: Review;
}

export interface ReviewListResponse {
  EC: number;
  EM: string;
  data?: Review[];
  total?: number;
}

export interface BookingForReview {
  booking_id: string;
  package_id: string;
  package_name: string;
  destination: string;
  status: string;
  booking_date: string;
  tour_dates?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {}

  private get apiBaseUrl(): string {
    return this.configService.getApiUrl();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // Get user's bookings that can be reviewed (completed or confirmed)
  getBookingsForReview(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/bookings/my-bookings?status=completed`, {
      headers: this.getHeaders()
    });
  }

  // Get all bookings (for filtering completed ones)
  getAllBookingsForReview(): Observable<any> {
    return this.http.get(`${this.apiBaseUrl}/bookings/my-bookings`, {
      headers: this.getHeaders()
    });
  }

  // Get all reviews by user
  getUserReviews(): Observable<ReviewListResponse> {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return this.http.get<ReviewListResponse>(
      `${this.apiBaseUrl}/reviews?user_id=${user.user_id}`,
      { headers: this.getHeaders() }
    );
  }

  // Create a new review
  createReview(review: ReviewCreate): Observable<ReviewResponse> {
    return this.http.post<ReviewResponse>(
      `${this.apiBaseUrl}/reviews`,
      review,
      { headers: this.getHeaders() }
    );
  }

  // Update a review
  updateReview(reviewId: string, review: ReviewUpdate): Observable<ReviewResponse> {
    return this.http.put<ReviewResponse>(
      `${this.apiBaseUrl}/reviews/${reviewId}`,
      review,
      { headers: this.getHeaders() }
    );
  }

  // Delete a review
  deleteReview(reviewId: string): Observable<ReviewResponse> {
    return this.http.delete<ReviewResponse>(
      `${this.apiBaseUrl}/reviews/${reviewId}`,
      { headers: this.getHeaders() }
    );
  }

  // Get review by ID
  getReview(reviewId: string): Observable<ReviewResponse> {
    return this.http.get<ReviewResponse>(
      `${this.apiBaseUrl}/reviews/${reviewId}`,
      { headers: this.getHeaders() }
    );
  }
}
