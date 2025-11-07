import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TourCardComponent } from '../../components/tour-card/tour-card.component';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { TourService } from '../../services/tour.service';
import { Tour, TourSearchParams } from '../../shared/models/tour.model';

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

  categories = [
    { id: 'beach', name: 'Biển', icon: 'fa-umbrella-beach' },
    { id: 'mountain', name: 'Núi', icon: 'fa-mountain' },
    { id: 'city', name: 'Thành phố', icon: 'fa-city' },
    { id: 'cultural', name: 'Văn hóa', icon: 'fa-landmark' },
    { id: 'adventure', name: 'Phiêu lưu', icon: 'fa-hiking' },
    { id: 'relax', name: 'Nghỉ dưỡng', icon: 'fa-spa' }
  ];

  selectedCategory: string | null = null;
  sortBy: 'price_asc' | 'price_desc' | 'duration' | 'popular' = 'popular';

  constructor(
    private tourService: TourService,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.searchParams = params as TourSearchParams;
      this.loadTours();
    });
  }

  async loadTours() {
    this.isLoading = true;
    try {
      if (Object.keys(this.searchParams).length > 0) {
        this.tours = await this.tourService.searchTours(this.searchParams);
      } else {
        this.tours = await this.tourService.getTours();
      }
      this.applyFilters();
    } catch (error) {
      console.error('Error loading tours:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSearch(params: TourSearchParams) {
    this.searchParams = params;
    this.loadTours();
  }

  selectCategory(categoryId: string) {
    this.selectedCategory = this.selectedCategory === categoryId ? null : categoryId;
    this.applyFilters();
  }

  changeSortBy(sortBy: 'price_asc' | 'price_desc' | 'duration' | 'popular') {
    this.sortBy = sortBy;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.tours];

    if (this.selectedCategory) {
      filtered = filtered.filter(tour => tour.category === this.selectedCategory);
    }

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
