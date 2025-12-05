import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminTourService, TourPackage, TourPackageCreateRequest, TourPackageUpdateRequest } from '../../../services/admin-tour.service';

@Component({
  selector: 'app-tour-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tour-list.component.html',
  styleUrl: './tour-list.component.scss'
})
export class TourListComponent implements OnInit {
  tours: TourPackage[] = [];
  filteredTours: TourPackage[] = [];
  
  // Filters
  searchTerm = '';
  statusFilter: string = '';
  destinationFilter = '';
  
  // Modals
  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;
  
  // Current tour for edit/delete
  currentTour: Partial<TourPackage> = {};
  deleteId = '';
  
  // Loading state
  isLoading = false;
  errorMessage = '';

  constructor(private tourService: AdminTourService) {}

  ngOnInit() {
    this.loadTours();
  }

  async loadTours() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      const response = await this.tourService.getTourPackages();
      this.tours = response.packages || [];
      this.applyFilters();
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể tải danh sách tours';
      console.error('Load tours error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  applyFilters() {
    this.filteredTours = this.tours.filter(tour => {
      const matchesSearch = !this.searchTerm || 
        tour.package_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        tour.destination.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesStatus = !this.statusFilter || 
        (this.statusFilter === 'active' && tour.is_active) ||
        (this.statusFilter === 'inactive' && !tour.is_active);
      
      const matchesDestination = !this.destinationFilter ||
        tour.destination.toLowerCase().includes(this.destinationFilter.toLowerCase());
      
      return matchesSearch && matchesStatus && matchesDestination;
    });
  }

  onFilterChange() {
    this.applyFilters();
  }

  // Add Modal
  openAddModal() {
    this.currentTour = {
      package_name: '',
      destination: '',
      description: '',
      duration_days: 1,
      price: 0,
      available_slots: 0,
      start_date: '',
      end_date: '',
      image_urls: '',
      cuisine: '',
      suitable_for: '',
      is_active: true
    };
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.currentTour = {};
  }

  async saveTour() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      
      const data: TourPackageCreateRequest = {
        package_name: this.currentTour.package_name!,
        destination: this.currentTour.destination!,
        description: this.currentTour.description!,
        duration_days: this.currentTour.duration_days!,
        price: this.currentTour.price!,
        available_slots: this.currentTour.available_slots!,
        start_date: this.currentTour.start_date!,
        end_date: this.currentTour.end_date!,
        image_urls: this.currentTour.image_urls!,
        cuisine: this.currentTour.cuisine!,
        suitable_for: this.currentTour.suitable_for!,
        is_active: this.currentTour.is_active!
      };
      
      await this.tourService.createTourPackage(data);
      await this.loadTours();
      this.closeAddModal();
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể tạo tour';
      console.error('Create tour error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Edit Modal
  openEditModal(tour: TourPackage) {
    this.currentTour = { ...tour };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.currentTour = {};
  }

  async updateTour() {
    try {
      if (!this.currentTour.package_id) return;
      
      this.isLoading = true;
      this.errorMessage = '';
      
      const { package_id, created_at, updated_at, ...updateData } = this.currentTour;
      
      await this.tourService.updateTourPackage(package_id, updateData);
      await this.loadTours();
      this.closeEditModal();
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể cập nhật tour';
      console.error('Update tour error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Delete Modal
  confirmDelete(packageId: string) {
    this.deleteId = packageId;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.deleteId = '';
  }

  async deleteTour() {
    try {
      if (!this.deleteId) return;
      
      this.isLoading = true;
      this.errorMessage = '';
      
      await this.tourService.deleteTourPackage(this.deleteId);
      await this.loadTours();
      this.closeDeleteModal();
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể xóa tour';
      console.error('Delete tour error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Toggle status
  async toggleStatus(tour: TourPackage) {
    try {
      if (!tour.package_id) return;
      
      this.isLoading = true;
      await this.tourService.updateTourPackage(tour.package_id, {
        is_active: !tour.is_active
      });
      await this.loadTours();
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể cập nhật trạng thái';
      console.error('Toggle status error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Utilities
  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('vi-VN');
  }

  getImageUrl(imageUrls: string): string {
    return imageUrls.split('|')[0] || 'https://via.placeholder.com/300x200';
  }
}
