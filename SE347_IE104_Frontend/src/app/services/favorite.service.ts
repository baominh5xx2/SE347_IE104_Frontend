import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { AuthService } from './auth.service';
import { FavoriteResponse, FavoriteListResponse, FavoriteCheckResponse } from '../shared/models/tour.model';

@Injectable({
  providedIn: 'root'
})
export class FavoriteService {
  constructor(
    private configService: ConfigService,
    private authService: AuthService
  ) { }

  private get apiBaseUrl(): string {
    return this.configService.getApiUrl();
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.authService.getToken();
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  /**
   * Get all favorite tours for the current user
   * @returns Promise with favorite tours list
   */
  async getMyFavorites(): Promise<FavoriteListResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/favorites/my`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        let errorMessage = '';
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Vui lòng đăng nhập để xem tours yêu thích';
        } else if (response.status === 404) {
          errorMessage = 'Không tìm thấy endpoint favorites';
        } else if (response.status === 500) {
          errorMessage = 'Lỗi máy chủ khi tải tours yêu thích. Vui lòng thử lại sau.';
        } else {
          errorMessage = `Lỗi khi tải tours yêu thích (${response.status})`;
        }

        try {
          const errorData = await response.json();
          if (errorData.EM) {
            errorMessage = errorData.EM;
          } else if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' 
              ? errorData.detail 
              : errorData.detail.toString();
          }
        } catch {
          // Use default error message
        }

        throw new Error(errorMessage);
      }

      const data: FavoriteListResponse = await response.json();

      if (data.EC !== 0) {
        throw new Error(data.EM || 'Lỗi khi tải tours yêu thích từ server.');
      }

      console.log('Favorite tours loaded:', data.total, 'tours');
      return data;
    } catch (error: any) {
      console.error('Error fetching favorite tours:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối internet.');
      }
      throw error;
    }
  }

  /**
   * Add a tour to favorites
   * @param packageId UUID of the tour package
   * @returns Promise with favorite response
   */
  async addFavorite(packageId: string): Promise<FavoriteResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/favorites/`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ package_id: packageId })
      });

      if (!response.ok) {
        let errorMessage = '';
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Vui lòng đăng nhập để thêm tour yêu thích';
        } else if (response.status === 409) {
          errorMessage = 'Tour đã có trong danh sách yêu thích';
        } else if (response.status === 400) {
          errorMessage = 'Yêu cầu không hợp lệ';
        } else if (response.status === 500) {
          errorMessage = 'Lỗi máy chủ khi thêm tour yêu thích. Vui lòng thử lại sau.';
        } else {
          errorMessage = `Lỗi khi thêm tour yêu thích (${response.status})`;
        }

        try {
          const errorData = await response.json();
          if (errorData.EM) {
            errorMessage = errorData.EM;
          } else if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' 
              ? errorData.detail 
              : errorData.detail.toString();
          }
        } catch {
          // Use default error message
        }

        throw new Error(errorMessage);
      }

      const data: FavoriteResponse = await response.json();

      if (data.EC !== 0) {
        throw new Error(data.EM || 'Lỗi khi thêm tour yêu thích từ server.');
      }

      console.log('Tour added to favorites:', packageId);
      return data;
    } catch (error: any) {
      console.error('Error adding favorite:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối internet.');
      }
      throw error;
    }
  }

  /**
   * Remove a tour from favorites
   * @param packageId UUID of the tour package
   * @returns Promise with favorite response
   */
  async removeFavorite(packageId: string): Promise<FavoriteResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/favorites/${packageId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        let errorMessage = '';
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Vui lòng đăng nhập để xóa tour yêu thích';
        } else if (response.status === 404) {
          errorMessage = 'Tour không có trong danh sách yêu thích';
        } else if (response.status === 400) {
          errorMessage = 'Yêu cầu không hợp lệ';
        } else if (response.status === 500) {
          errorMessage = 'Lỗi máy chủ khi xóa tour yêu thích. Vui lòng thử lại sau.';
        } else {
          errorMessage = `Lỗi khi xóa tour yêu thích (${response.status})`;
        }

        try {
          const errorData = await response.json();
          if (errorData.EM) {
            errorMessage = errorData.EM;
          } else if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' 
              ? errorData.detail 
              : errorData.detail.toString();
          }
        } catch {
          // Use default error message
        }

        throw new Error(errorMessage);
      }

      const data: FavoriteResponse = await response.json();

      if (data.EC !== 0) {
        throw new Error(data.EM || 'Lỗi khi xóa tour yêu thích từ server.');
      }

      console.log('Tour removed from favorites:', packageId);
      return data;
    } catch (error: any) {
      console.error('Error removing favorite:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối internet.');
      }
      throw error;
    }
  }

  /**
   * Check if a tour is favorited by the current user
   * @param packageId UUID of the tour package
   * @returns Promise with favorite check response
   */
  async checkFavorite(packageId: string): Promise<FavoriteCheckResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/favorites/check/${packageId}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        // If not authenticated, return false
        if (response.status === 401 || response.status === 403) {
          return {
            EC: 0,
            EM: 'Not authenticated',
            is_favorite: false
          };
        }

        let errorMessage = '';
        if (response.status === 404) {
          errorMessage = 'Không tìm thấy endpoint check favorite';
        } else if (response.status === 500) {
          errorMessage = 'Lỗi máy chủ khi kiểm tra trạng thái yêu thích';
        } else {
          errorMessage = `Lỗi khi kiểm tra trạng thái yêu thích (${response.status})`;
        }

        try {
          const errorData = await response.json();
          if (errorData.EM) {
            errorMessage = errorData.EM;
          }
        } catch {
          // Use default error message
        }

        throw new Error(errorMessage);
      }

      const data: FavoriteCheckResponse = await response.json();

      if (data.EC !== 0) {
        // Return false on error instead of throwing
        return {
          EC: 0,
          EM: data.EM || 'Error checking favorite status',
          is_favorite: false
        };
      }

      return data;
    } catch (error: any) {
      console.error('Error checking favorite status:', error);
      // Return false on error instead of throwing
      return {
        EC: 0,
        EM: error.message || 'Error checking favorite status',
        is_favorite: false
      };
    }
  }
}
