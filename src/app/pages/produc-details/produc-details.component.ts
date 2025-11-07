import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { HotelService } from '../../services/hotel.service';
import { TourService } from '../../services/tour.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Tour } from '../../shared/models/tour.model';

interface Hotel {
  name: string;
  rating: number;
  reviews: number;
  location: string;
  images: string[];
  price: number;
  description: string;
  address: string;
  amenities: any[]
}

interface RoomOption {
  id: number,
  name: string;
  description: string;
  guests: number;
  price: number;
  originalPrice: number;
  breakfastIncluded: boolean;
}

interface Room {
  name: string;
  imageUrl: string;
  size: string;
  options: RoomOption[];
}

@Component({
  selector: 'app-produc-details',
  imports: [CommonModule],
  templateUrl: './produc-details.component.html',
  styleUrl: './produc-details.component.scss'
})
export class ProducDetailsComponent implements OnInit {
  tour: Tour | null = null;
  isLoadingTour = true;
  isTourMode = false;

  hotel: Hotel = {
    name: 'Bukit Vipassana Hotel',
    location: 'Lembang, Bandung',
    rating: 8.4,
    reviews: 1160,
    price: 368569,
    images: [
      'img/hotel.jpeg',
      'img/hotel.jpeg',
      'img/hotel.jpeg',
      'img/hotel.jpeg',
      'img/hotel.jpeg',
      'img/hotel.jpeg',
      'img/hotel.jpeg',
    ],
    description: 'Khách sạn này mang đến sự thoải mái và tiện ích tốt nhất cho bạn.',
    address: 'JL. Kolonel Masturi No. 99, Lembang, Bandung, Jawa Barat, Indonesia, 40391',
    amenities: ['Nhà hàng', 'Hồ bơi', 'Lễ tân 24 giờ', 'WiFi', 'Bãi đỗ xe'],

  };


  room: Room = {
    name: 'Superior Twin Bed',
    imageUrl: 'img/hotel.jpeg',
    size: '24.0 m²',
    options: [
      {
        id: 1,
        name: 'Không bao gồm bữa sáng',
        description: '1 giường đôi',
        guests: 2,
        price: 368569,
        originalPrice: 491125,
        breakfastIncluded: false,
      },
      {
        id: 2,
        name: 'Bao gồm bữa sáng cho 1 người',
        description: '1 giường đôi',
        guests: 1,
        price: 417709,
        originalPrice: 556945,
        breakfastIncluded: true,
      },
    ],
  };


  constructor(
    private hotelService: HotelService,
    private tourService: TourService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  async ngOnInit(): Promise<void> {
    this.route.params.subscribe(async params => {
      const id = params['id'];
      
      if (id) {
        this.isTourMode = true;
        await this.loadTourDetails(id);
      } else {
        this.isTourMode = false;
        this.route.queryParams.subscribe(res => {
          let result = this.hotelService.filterHotels(res['param']);
          if (result.length > 0) {
            this.hotel.name = result[0].name;
            this.hotel.location = result[0].location;
          }
        });
      }
    });
  }

  async loadTourDetails(tourId: string): Promise<void> {
    try {
      this.isLoadingTour = true;
      console.log('Loading tour details for ID:', tourId);
      
      this.tour = await this.tourService.getTourById(tourId);
      
      if (!this.tour) {
        console.error('Tour not found with ID:', tourId);
        alert('Không tìm thấy tour với ID: ' + tourId);
      }
    } catch (error) {
      console.error('Error loading tour:', error);
      alert('Lỗi khi tải thông tin tour: ' + error);
    } finally {
      this.isLoadingTour = false;
    }
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  getDiscountedPrice(tour: Tour): number {
    if (tour.discount && tour.original_price) {
      return tour.original_price * (1 - tour.discount / 100);
    }
    return tour.price;
  }

  onBookTour(): void {
    if (this.tour) {
      this.router.navigate(['/booking', this.tour.package_id]);
    }
  }

  scrollToRoomDetails() {
    const element = document.getElementById('room-details');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  onBook(id: number) {
    this.router.navigate([`booking/${id}`])
  }

}
