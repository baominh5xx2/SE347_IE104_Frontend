import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Tour, TourSearchParams, ChatMessage, StreamEvent, TourPackageListResponse, TourPackageParams, TourPackageDetailResponse } from '../shared/models/tour.model';

@Injectable({
  providedIn: 'root'
})
export class TourService {
  private apiBaseUrl = 'http://localhost:8000/api/v1';
  private toursSubject = new BehaviorSubject<Tour[]>([]);
  public tours$ = this.toursSubject.asObservable();

  constructor() { }

  async getTourPackages(params?: TourPackageParams): Promise<TourPackageListResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params) {
        if (params.is_active !== undefined && params.is_active !== null) {
          queryParams.append('is_active', params.is_active.toString());
        }
        if (params.destination !== undefined && params.destination !== null && params.destination !== '') {
          queryParams.append('destination', params.destination);
        }
        if (params.limit !== undefined && params.limit !== null) {
          queryParams.append('limit', params.limit.toString());
        }
        if (params.offset !== undefined && params.offset !== null) {
          queryParams.append('offset', params.offset.toString());
        }
      }

      const url = `${this.apiBaseUrl}/tour-packages${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      console.log('Fetching tour packages from URL:', url);
      
      const response = await fetch(url);
      
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Tour packages endpoint not found (404). Backend may not have this endpoint yet.');
          console.warn('Returning empty result. Please ensure backend has /api/v1/tour-packages endpoint implemented.');
          return {
            EC: 0,
            EM: 'Success',
            total: 0,
            packages: []
          };
        }
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`Failed to fetch tour packages: ${response.status} ${response.statusText}`);
      }
      
      const data: TourPackageListResponse = await response.json();
      console.log('API Response data:', data);
      
      if (data.EC !== 0) {
        console.error('API returned error code:', data.EC, 'Message:', data.EM);
        throw new Error(`API Error: ${data.EM}`);
      }
      
      if (!data.packages || !Array.isArray(data.packages)) {
        console.error('Invalid packages data:', data);
        throw new Error('Invalid response format: packages is not an array');
      }
      
      console.log('Tour packages loaded from API:', data.packages.length, 'Total:', data.total);
      this.toursSubject.next(data.packages);
      
      return data;
    } catch (error) {
      console.error('Error fetching tour packages from API:', error);
      console.warn('Returning empty result due to error');
      return {
        EC: 0,
        EM: 'Success',
        total: 0,
        packages: []
      };
    }
  }

  async getTours(): Promise<Tour[]> {
    try {
      const response = await this.getTourPackages({ is_active: true });
      return response.packages;
    } catch (error) {
      console.error('Error fetching tours from API:', error);
      throw error;
    }
  }

  async getTourPackageById(packageId: string): Promise<TourPackageDetailResponse> {
    try {
      console.log('Fetching tour package by ID from API:', packageId);
      const response = await fetch(`${this.apiBaseUrl}/tour-packages/${packageId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tour package ${packageId}: ${response.status} ${response.statusText}`);
      }
      
      const data: TourPackageDetailResponse = await response.json();
      
      if (data.EC !== 0) {
        throw new Error(`API Error: ${data.EM}`);
      }
      
      console.log('Tour package loaded from API:', data.package);
      return data;
    } catch (error) {
      console.error('Error fetching tour package from API:', error);
      throw error;
    }
  }

  async getTourById(id: string): Promise<Tour | null> {
    try {
      const response = await this.getTourPackageById(id);
      return response.package;
    } catch (error) {
      console.error('Error fetching tour from API:', error);
      throw error;
    }
  }

  async searchTours(params: TourSearchParams): Promise<Tour[]> {
    try {
      const packageParams: TourPackageParams = {
        is_active: true
      };

      if (params.destination) {
        packageParams.destination = params.destination;
      }

      const response = await this.getTourPackages(packageParams);
      let tours = response.packages;

      if (params.departure_location || params.price_min || params.price_max || 
          params.duration_min || params.duration_max || params.category) {
        tours = this.filterTours(tours, params);
      }

      console.log('Search results from API:', tours.length);
      this.toursSubject.next(tours);
      return tours;
    } catch (error) {
      console.error('Error searching tours from API:', error);
      throw error;
    }
  }

  async getToursByDestination(destination: string): Promise<Tour[]> {
    return this.searchTours({ destination });
  }

  async getToursByCategory(category: string): Promise<Tour[]> {
    return this.searchTours({ category });
  }

  async getRecommendedTours(limit: number = 6): Promise<Tour[]> {
    try {
      const response = await this.getTourPackages({ 
        is_active: true, 
        limit: limit 
      });
      console.log('Recommended tours from API:', response.packages.length);
      return response.packages;
    } catch (error) {
      console.error('Error fetching recommended tours from API:', error);
      throw error;
    }
  }

  private getMockTours(limit: number = 6): Tour[] {
    const mockTours: Tour[] = [
      {
        package_id: 'tour_001',
        package_name: 'Tour Đà Lạt 3 Ngày 2 Đêm - Khám Phá Thành Phố Ngàn Hoa',
        destination: 'Đà Lạt',
        departure_location: 'Hồ Chí Minh',
        duration_days: 3,
        price: 4500000,
        original_price: 6000000,
        discount: 25,
        rating: 4.8,
        reviews: 156,
        description: 'Khám phá vẻ đẹp lãng mạn của Đà Lạt với những cảnh hoa tuyệt đẹp',
        highlights: ['Thung lũng tình yêu', 'Dinh Bảo Đại', 'Chợ đêm Đà Lạt'],
        image_url: 'img/hotel.jpeg',
        category: 'relax'
      },
      {
        package_id: 'tour_002',
        package_name: 'Tour Nha Trang 4 Ngày 3 Đêm - Biển Xanh Cát Trắng',
        destination: 'Nha Trang',
        departure_location: 'Hà Nội',
        duration_days: 4,
        price: 6800000,
        original_price: 8500000,
        discount: 20,
        rating: 4.9,
        reviews: 203,
        description: 'Trải nghiệm biển đẹp và ẩm thực tươi ngon',
        highlights: ['Đảo Robinson', 'Vinpearl Land', 'Tắm biển'],
        image_url: 'img/hotel.jpeg',
        category: 'beach'
      },
      {
        package_id: 'tour_003',
        package_name: 'Tour Hạ Long 2 Ngày 1 Đêm - Di Sản Thế Giới',
        destination: 'Hạ Long, Quảng Ninh',
        departure_location: 'Hà Nội',
        duration_days: 2,
        price: 3200000,
        rating: 4.7,
        reviews: 128,
        description: 'Khám phá vịnh Hạ Long tuyệt đẹp',
        highlights: ['Hang Sửng Sốt', 'Đảo Ti Tốp', 'Du thuyền 5 sao'],
        image_url: 'img/hotel.jpeg',
        category: 'adventure'
      },
      {
        package_id: 'tour_004',
        package_name: 'Tour Phú Quốc 5 Ngày 4 Đêm - Thiên Đường Đảo Ngọc',
        destination: 'Phú Quốc',
        departure_location: 'Hồ Chí Minh',
        duration_days: 5,
        price: 8900000,
        original_price: 11000000,
        discount: 19,
        rating: 4.9,
        reviews: 245,
        description: 'Nghỉ dưỡng trên đảo ngọc Phú Quốc',
        highlights: ['Vinpearl Safari', 'Bãi Sao', 'Grand World'],
        image_url: 'img/hotel.jpeg',
        category: 'beach'
      },
      {
        package_id: 'tour_005',
        package_name: 'Tour Sa Pa 3 Ngày 2 Đêm - Chinh Phục Fansipan',
        destination: 'Sa Pa, Lào Cai',
        departure_location: 'Hà Nội',
        duration_days: 3,
        price: 4200000,
        rating: 4.6,
        reviews: 98,
        description: 'Chinh phục đỉnh Fansipan và khám phá văn hóa dân tộc',
        highlights: ['Đỉnh Fansipan', 'Cát Cát', 'Thác Tình Yêu'],
        image_url: 'img/hotel.jpeg',
        category: 'mountain'
      },
      {
        package_id: 'tour_006',
        package_name: 'Tour Hội An 3 Ngày 2 Đêm - Phố Cổ Và Đêm Hội',
        destination: 'Hội An, Quảng Nam',
        departure_location: 'Đà Nẵng',
        duration_days: 3,
        price: 3800000,
        rating: 4.8,
        reviews: 187,
        description: 'Trải nghiệm phố cổ Hội An với những ngọn đèn lung linh',
        highlights: ['Phố cổ Hội An', 'Cầu Nhật Bản', 'Rừng dừa Bảy Mẫu'],
        image_url: 'img/hotel.jpeg',
        category: 'cultural'
      }
    ];

    return mockTours.slice(0, limit);
  }

  async getAIRecommendations(message: string, conversationId?: string, userId?: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const response = await fetch(`${this.apiBaseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        user_id: userId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body.getReader();
  }

  filterTours(tours: Tour[], params: TourSearchParams): Tour[] {
    return tours.filter(tour => {
      const matchesDestination = !params.destination || 
        tour.destination.toLowerCase().includes(params.destination.toLowerCase());
      
      const matchesDeparture = !params.departure_location || 
        tour.departure_location.toLowerCase().includes(params.departure_location.toLowerCase());
      
      const matchesPrice = (!params.price_min || tour.price >= params.price_min) &&
        (!params.price_max || tour.price <= params.price_max);
      
      const matchesDuration = (!params.duration_min || tour.duration_days >= params.duration_min) &&
        (!params.duration_max || tour.duration_days <= params.duration_max);
      
      const matchesCategory = !params.category || tour.category === params.category;

      return matchesDestination && matchesDeparture && matchesPrice && matchesDuration && matchesCategory;
    });
  }

  setApiBaseUrl(url: string): void {
    this.apiBaseUrl = url;
  }
}
