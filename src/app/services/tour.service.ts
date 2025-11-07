import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Tour, TourSearchParams, ChatMessage, StreamEvent } from '../shared/models/tour.model';

@Injectable({
  providedIn: 'root'
})
export class TourService {
  private apiBaseUrl = 'http://localhost:8000/api/v1';
  private toursSubject = new BehaviorSubject<Tour[]>([]);
  public tours$ = this.toursSubject.asObservable();

  constructor() { }

  async getTours(): Promise<Tour[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/tours`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tours: ${response.status} ${response.statusText}`);
      }
      const tours = await response.json();
      console.log('Tours loaded from API:', tours.length);
      this.toursSubject.next(tours);
      return tours;
    } catch (error) {
      console.error('Error fetching tours from API:', error);
      throw error;
    }
  }

  async getTourById(id: string): Promise<Tour | null> {
    try {
      console.log('Fetching tour by ID from API:', id);
      const response = await fetch(`${this.apiBaseUrl}/tours/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tour ${id}: ${response.status} ${response.statusText}`);
      }
      
      const tour = await response.json();
      console.log('Tour loaded from API:', tour);
      return tour;
    } catch (error) {
      console.error('Error fetching tour from API:', error);
      throw error;
    }
  }

  async searchTours(params: TourSearchParams): Promise<Tour[]> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.apiBaseUrl}/tours/search?${queryParams}`);
      if (!response.ok) {
        throw new Error(`Failed to search tours: ${response.status} ${response.statusText}`);
      }
      const tours = await response.json();
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
      const response = await fetch(`${this.apiBaseUrl}/tours/recommended?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch recommended tours: ${response.status} ${response.statusText}`);
      }
      const tours = await response.json();
      console.log('Recommended tours from API:', tours.length);
      return tours;
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
