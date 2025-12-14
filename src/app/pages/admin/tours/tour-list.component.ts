import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminTourService, TourPackage, TourPackageCreateRequest, TourPackageUpdateRequest } from '../../../services/admin/admin-tour.service';

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
  paginatedTours: TourPackage[] = [];
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  
  // Filters
  searchTerm = '';
  statusFilter: string = '';
  destinationFilter = '';
  
  // Modals
  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;
  showPreviewModal = false;
  
  // Current tour for edit/delete
  currentTour: Partial<TourPackage> = {};
  deleteId = '';
  previewTour: Partial<TourPackage> = {};
  
  // UI State
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // File upload state
  selectedFiles: File[] = [];
  previewUrls: string[] = [];
  existingImageUrls: string[] = []; // Store existing images from server
  isUploading = false;
  uploadProgress = 0;
  draggedIndex: number | null = null;

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
    
    // Calculate pagination
    this.totalPages = Math.ceil(this.filteredTours.length / this.itemsPerPage);
    this.currentPage = 1; // Reset to first page on filter change
    this.updatePaginatedTours();
  }
  
  updatePaginatedTours() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedTours = this.filteredTours.slice(startIndex, endIndex);
  }
  
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedTours();
    }
  }
  
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePaginatedTours();
    }
  }
  
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePaginatedTours();
    }
  }
  
  getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = [];
    
    if (this.totalPages <= 7) {
      // If total pages <= 7, show all pages
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (this.currentPage <= 3) {
        // Near start: show 1 2 3 4 ... last
        pages.push(2, 3, 4, '...', this.totalPages);
      } else if (this.currentPage >= this.totalPages - 2) {
        // Near end: show 1 ... n-3 n-2 n-1 n
        pages.push('...', this.totalPages - 3, this.totalPages - 2, this.totalPages - 1, this.totalPages);
      } else {
        // Middle: show 1 ... current-1 current current+1 ... last
        pages.push('...', this.currentPage - 1, this.currentPage, this.currentPage + 1, '...', this.totalPages);
      }
    }
    
    return pages;
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
  
  // Add Math property for template access
  Math = Math;

  closeAddModal() {
    this.showAddModal = false;
    this.currentTour = {};
    this.clearFiles();
  }

  async saveTour() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      
      // Validate required files
      if (this.selectedFiles.length === 0) {
        this.errorMessage = 'Vui lòng chọn ít nhất 1 hình ảnh';
        this.isLoading = false;
        return;
      }

      const data: TourPackageCreateRequest = {
        package_name: this.currentTour.package_name!,
        destination: this.currentTour.destination!,
        description: this.currentTour.description!,
        duration_days: this.currentTour.duration_days!,
        price: this.currentTour.price!,
        available_slots: this.currentTour.available_slots!,
        start_date: this.currentTour.start_date!,
        end_date: this.currentTour.end_date!,
        cuisine: this.currentTour.cuisine,
        suitable_for: this.currentTour.suitable_for,
        is_active: this.currentTour.is_active!
      };
      
      this.isUploading = true;
      await this.tourService.createTourPackage(data, this.selectedFiles);
      await this.loadTours();
      this.successMessage = 'Tạo tour thành công!';
      setTimeout(() => this.successMessage = '', 3000);
      this.closeAddModal();
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể tạo tour';
      console.error('Create tour error:', error);
    } finally {
      this.isLoading = false;
      this.isUploading = false;
    }
  }

  // Edit Modal
  openEditModal(tour: TourPackage) {
    this.currentTour = { ...tour };
    this.clearFiles();
    
    // Load existing images to preview
    if (tour.image_urls) {
      const imageUrls = tour.image_urls.split('|').filter(url => url.trim());
      this.existingImageUrls = imageUrls;
      this.previewUrls = [...imageUrls]; // Copy to previewUrls for display
    }
    
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.currentTour = {};
    this.clearFiles();
    this.existingImageUrls = [];
  }

  async updateTour() {
    try {
      if (!this.currentTour.package_id) return;
      
      this.isLoading = true;
      this.errorMessage = '';
      
      const { package_id, created_at, updated_at, ...updateData } = this.currentTour;
      
      // Check if images were modified
      const hasRemovedImages = this.previewUrls.length < this.existingImageUrls.length;
      const hasReorderedImages = this.previewUrls.some((url, index) => 
        this.existingImageUrls[index] !== url
      );
      const hasNewImages = this.selectedFiles.length > 0;
      
      // Update image_urls if images were removed or reordered
      if (hasRemovedImages || hasReorderedImages) {
        const reorderedExistingUrls = this.previewUrls.filter(url => 
          this.existingImageUrls.includes(url)
        );
        updateData.image_urls = reorderedExistingUrls.join('|');
      }
      
      // Update tour data first
      await this.tourService.updateTourPackage(package_id, updateData);
      
      // If new images added, upload them (append, not replace)
      if (hasNewImages) {
        this.isUploading = true;
        await this.tourService.updateTourImages(package_id, this.selectedFiles, false);
      }
      
      await this.loadTours();
      this.successMessage = 'Cập nhật tour thành công!';
      setTimeout(() => this.successMessage = '', 3000);
      this.closeEditModal();
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể cập nhật tour';
      console.error('Update tour error:', error);
    } finally {
      this.isLoading = false;
      this.isUploading = false;
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
      this.successMessage = `Đã ${!tour.is_active ? 'kích hoạt' : 'tạm dừng'} tour thành công!`;
      setTimeout(() => this.successMessage = '', 3000);
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

  isMaxImagesReached(): boolean {
    return this.previewUrls.length >= 10;
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      
      // Check total files after adding new ones (including existing images)
      const existingCount = this.existingImageUrls.length;
      const totalFiles = existingCount + this.selectedFiles.length + newFiles.length;
      if (totalFiles > 10) {
        this.errorMessage = `Bạn đã có ${existingCount} ảnh cũ và đang chọn thêm ${this.selectedFiles.length + newFiles.length} ảnh mới. Tổng ${totalFiles} ảnh vượt quá giới hạn 10 ảnh. Vui lòng bỏ bớt ${totalFiles - 10} ảnh.`;
        return;
      }

      // Validate file types
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const invalidFiles = newFiles.filter(f => !allowedTypes.includes(f.type));
      if (invalidFiles.length > 0) {
        this.errorMessage = 'Chỉ chấp nhận file JPEG, JPG, PNG, WebP';
        return;
      }

      // Add new files to existing ones
      this.selectedFiles = [...this.selectedFiles, ...newFiles];
      this.errorMessage = '';

      // Generate preview URLs for new files
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.previewUrls.push(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
      
      // Clear input to allow selecting same files again
      input.value = '';
    }
  }

  removeFile(index: number) {
    // Check if this is an existing image or new file
    const existingCount = this.existingImageUrls.length;
    
    if (index < existingCount) {
      // Remove from existing images
      this.existingImageUrls.splice(index, 1);
    } else {
      // Remove from new files
      const fileIndex = index - existingCount;
      this.selectedFiles.splice(fileIndex, 1);
    }
    
    this.previewUrls.splice(index, 1);
  }

  clearFiles() {
    this.selectedFiles = [];
    this.previewUrls = [];
    this.existingImageUrls = [];
  }

  onDragStart(index: number) {
    this.draggedIndex = index;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    
    if (this.draggedIndex === null || this.draggedIndex === dropIndex) {
      return;
    }

    // Simply reorder previewUrls - this is what user sees
    const draggedUrl = this.previewUrls[this.draggedIndex];
    this.previewUrls.splice(this.draggedIndex, 1);
    this.previewUrls.splice(dropIndex, 0, draggedUrl);
    
    this.draggedIndex = null;
  }

  onDragEnd() {
    this.draggedIndex = null;
  }

  openPreview() {
    // Create preview tour from current form data
    this.previewTour = {
      ...this.currentTour,
      package_id: this.currentTour.package_id || 'preview-id',
      created_at: this.currentTour.created_at || new Date().toISOString(),
      updated_at: this.currentTour.updated_at || new Date().toISOString(),
      // Use preview URLs if files are selected, otherwise use existing image_urls
      image_urls: this.previewUrls.length > 0 
        ? this.previewUrls.join('|') 
        : this.currentTour.image_urls || ''
    };
    this.showPreviewModal = true;
  }

  closePreview() {
    this.showPreviewModal = false;
    this.previewTour = {};
  }

  getPreviewImageUrls(): string[] {
    if (this.previewTour.image_urls) {
      return this.previewTour.image_urls.split('|').filter(url => url.trim());
    }
    return [];
  }

  getPreviewMainImage(): string {
    const urls = this.getPreviewImageUrls();
    return urls.length > 0 ? urls[0] : 'https://via.placeholder.com/800x400?text=No+Image';
  }

  getPreviewGalleryImages(): string[] {
    const urls = this.getPreviewImageUrls();
    return urls.slice(1, 5);
  }
}
