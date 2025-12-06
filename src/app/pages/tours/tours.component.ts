import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TourCardComponent } from '../../components/tour-card/tour-card.component';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { TourService } from '../../services/tour.service';
import { Tour, TourSearchParams, TourPackageSearchRequest } from '../../shared/models/tour.model';

@Component({
  selector: 'app-tours',
  imports: [CommonModule, FormsModule, TourCardComponent, SearchBarComponent],
  templateUrl: './tours.component.html',
  styleUrl: './tours.component.scss'
})
export class ToursComponent implements OnInit {
  tours: Tour[] = [];
  filteredTours: Tour[] = [];
  isLoading = false;
  searchParams: TourSearchParams = {};
  queryText: string = '';
  maxPrice: number | undefined;
  duration: number | undefined;
  totalFound: number = 0;
  errorMessage: string | null = null;

  sortBy: 'price_asc' | 'price_desc' | 'duration' | 'popular' = 'popular';

  constructor(
    private tourService: TourService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    const snapshotParams = this.route.snapshot.queryParams;
    this.searchParams = snapshotParams as TourSearchParams;
    this.queryText = snapshotParams['q'] || '';
    this.maxPrice = snapshotParams['max_price'] ? Number(snapshotParams['max_price']) : undefined;
    this.duration = snapshotParams['duration'] ? Number(snapshotParams['duration']) : undefined;
    
    await this.loadTours();

    this.route.queryParams.subscribe(params => {
      this.searchParams = params as TourSearchParams;
      this.queryText = params['q'] || '';
      this.maxPrice = params['max_price'] ? Number(params['max_price']) : undefined;
      this.duration = params['duration'] ? Number(params['duration']) : undefined;
      this.loadTours();
    });
  }

  async loadTours() {
    this.isLoading = true;
    this.errorMessage = null;
    try {
      if (this.queryText || this.maxPrice || this.duration || this.searchParams.destination) {
        const searchRequest: TourPackageSearchRequest = {
          q: this.queryText || undefined,
          max_price: this.maxPrice,
          duration: this.duration,
          destination: this.searchParams.destination,
          limit: 50
        };
        
        const response = await this.tourService.searchTourPackages(searchRequest);
        this.tours = response.packages || [];
        this.totalFound = response.found || 0;
      } else if (this.searchParams.destination || this.searchParams.departure_location || 
                 this.searchParams.price_min || this.searchParams.price_max || 
                 this.searchParams.duration_min || this.searchParams.duration_max) {
        const searchRequest: TourPackageSearchRequest = {
          q: undefined,
          max_price: this.searchParams.price_max,
          duration: this.searchParams.duration_min,
          destination: this.searchParams.destination,
          limit: 50
        };
        
        const response = await this.tourService.searchTourPackages(searchRequest);
        this.tours = response.packages || [];
        this.totalFound = response.found || 0;
      } else {
        const response = await this.tourService.getTourPackages({ 
          is_active: true, 
          limit: 100,
          offset: 0
        });
        this.tours = response.packages || [];
        this.totalFound = response.total || this.tours.length;
        console.log('Loaded all tour packages:', {
          total: response.total,
          packages: this.tours.length,
          sample: this.tours[0]
        });
      }
      this.applyFilters();
    } catch (error: any) {
      console.error('Error loading tours:', error);
      this.errorMessage = error?.message || 'Lỗi khi tải danh sách tour. Vui lòng thử lại sau.';
      this.tours = [];
      this.filteredTours = [];
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(params: any) {
    this.searchParams = {
      destination: params.destination,
      departure_location: params.departure_location,
      date_from: params.date_from,
      date_to: params.date_to
    };
    this.queryText = params.queryText || params.q || '';
    this.loadTours();
  }

  changeSortBy(sortBy: 'price_asc' | 'price_desc' | 'duration' | 'popular') {
    this.sortBy = sortBy;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.tours];

    switch (this.sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'duration':
        filtered.sort((a, b) => a.duration_days - b.duration_days);
        break;
      case 'popular':
        filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }

    this.filteredTours = filtered;
  }
}
