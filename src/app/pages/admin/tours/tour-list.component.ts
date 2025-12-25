import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminTourService, TourPackage, TourPackageCreateRequest, TourPackageUpdateRequest } from '../../../services/admin/admin-tour.service';
import { AdminDialogService } from '../../../services/admin/admin-dialog.service';

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

  // Advanced Filters toggle
  showAdvancedFilters = false;

  // Advanced Filters - Individual filter states
  // Date filter (range)
  startDateFilter = '';
  endDateFilter = '';
  isDateFilterActive = false;

  // Month/Year filter (combined)
  periodDateTypeFilter: 'start_date' | 'end_date' = 'start_date';
  periodMonthFilter: number | '' = '';
  periodYearFilter: number | '' = '';
  isPeriodFilterActive = false;

  // Price filter
  priceSegmentFilter: '' | 'budget' | 'mid' | 'premium' | 'custom' = '';
  minPriceFilter: number | '' = '';
  maxPriceFilter: number | '' = '';
  isPriceFilterActive = false;

  // Slot filter
  minSlotFilter: number | '' = '';
  maxSlotFilter: number | '' = '';
  isSlotFilterActive = false;

  currentYear = new Date().getFullYear();

  // Modals
  showAddModal = false;
  showEditModal = false;
  showDetailModal = false;
  showDeleteModal = false;
  showBulkUploadModal = false;
  showPreview = false; // Tour preview panel

  // Current tour for edit/delete
  currentTour: Partial<TourPackage> = {};
  deleteId = '';

  // Loading state
  isLoading = false;
  errorMessage = '';

  // Bulk upload
  selectedCSVFile: File | null = null;
  bulkUploadResult: any = null;

  // Image management
  selectedFiles: File[] = [];
  imageUrls: string[] = [];
  originalImageUrls: string[] = []; // Lưu URL ảnh gốc từ server
  draggedImageIndex: number | null = null;
  originalImageCount: number = 0; // Số ảnh ban đầu từ server
  hasImageChanges: boolean = false; // Có thay đổi ảnh không

  // Formatted price for display
  formattedPrice: string = '';

  constructor(
    private tourService: AdminTourService,
    private dialogService: AdminDialogService
  ) { }

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

  async applyFilters() {
    // Check if any advanced filters are active
    const hasDateFilter = this.startDateFilter && this.endDateFilter;
    const hasPeriodFilter = this.periodMonthFilter || this.periodYearFilter;
    const hasPriceFilter = this.priceSegmentFilter;
    const hasSlotFilter = this.minSlotFilter || this.maxSlotFilter;

    // If advanced filters are set, apply them via API calls
    if (hasDateFilter) {
      await this.applyDateFilter();
      return; // Date filter already calls applyFilters recursively
    }

    if (hasPeriodFilter) {
      await this.applyPeriodFilter();
      return; // Period filter already calls applyFilters recursively
    }

    if (hasPriceFilter) {
      await this.applyPriceFilter();
      return; // Price filter already calls applyFilters recursively
    }

    // Apply basic filters (search, status, destination) and slot filter
    this.filteredTours = this.tours.filter(tour => {
      const matchesSearch = !this.searchTerm ||
        tour.package_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        tour.destination.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = !this.statusFilter ||
        (this.statusFilter === 'active' && tour.is_active) ||
        (this.statusFilter === 'inactive' && !tour.is_active);

      const matchesDestination = !this.destinationFilter ||
        tour.destination.toLowerCase().includes(this.destinationFilter.toLowerCase());

      // Slot filter (client-side)
      const matchesSlot = !hasSlotFilter || (() => {
        const min = this.minSlotFilter ? Number(this.minSlotFilter) : 0;
        const max = this.maxSlotFilter ? Number(this.maxSlotFilter) : Infinity;
        return tour.available_slots >= min && tour.available_slots <= max;
      })();

      return matchesSearch && matchesStatus && matchesDestination && matchesSlot;
    });

    // Update slot filter active state
    this.isSlotFilterActive = !!hasSlotFilter;
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
    this.imageUrls = [];
    this.selectedFiles = [];
    this.formattedPrice = '';
    this.showPreview = true;  // Hiển thị preview mặc định khi tạo tour mới
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.showPreview = false;
    this.currentTour = {};
  }

  // Detail Modal
  openDetailModal(tour: TourPackage) {
    this.currentTour = { ...tour };
    this.imageUrls = tour.image_urls ? tour.image_urls.split(',') : [];
    this.showDetailModal = true;
    this.showPreview = true;
  }

  closeDetailModal() {
    this.showDetailModal = false;
    this.showPreview = false;
    this.currentTour = {};
  }

  togglePreview() {
    this.showPreview = !this.showPreview;
  }

  async saveTour() {
    try {
      this.isLoading = true;
      this.errorMessage = '';

      // Validate required fields
      if (!this.currentTour.package_name || !this.currentTour.destination || !this.currentTour.description) {
        this.errorMessage = 'Vui lòng điền đầy đủ thông tin bắt buộc';
        return;
      }

      if (this.selectedFiles.length === 0 && this.imageUrls.length === 0) {
        this.errorMessage = 'Vui lòng chọn ít nhất một hình ảnh';
        return;
      }

      const data = {
        package_name: this.currentTour.package_name!,
        destination: this.currentTour.destination!,
        description: this.currentTour.description!,
        duration_days: this.currentTour.duration_days!,
        price: this.currentTour.price!,
        available_slots: this.currentTour.available_slots!,
        start_date: this.currentTour.start_date!,
        end_date: this.currentTour.end_date!,
        cuisine: this.currentTour.cuisine || '',
        suitable_for: this.currentTour.suitable_for || '',
        is_active: this.currentTour.is_active!
      };

      // Create tour with images
      await this.tourService.createTourPackageWithImages(data, this.selectedFiles);
      await this.loadTours();
      this.closeAddModal();
      await this.dialogService.alert('Thành công', 'Thêm tour thành công!');
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể tạo tour';
      await this.dialogService.alert('Lỗi', this.errorMessage);
      console.error('Create tour error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Edit Modal
  openEditModal(tour: TourPackage) {
    this.currentTour = { ...tour };
    // Parse existing images
    this.imageUrls = tour.image_urls ? tour.image_urls.split('|').filter(url => url.trim()) : [];
    this.originalImageUrls = [...this.imageUrls]; // Lưu URL gốc
    this.originalImageCount = this.imageUrls.length;
    this.selectedFiles = [];
    this.hasImageChanges = false;
    this.formattedPrice = this.formatNumberWithCommas(tour.price);
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.currentTour = {};
  }

  async updateTour() {
    try {
      if (!this.currentTour.package_id) {
        this.errorMessage = 'Không tìm thấy ID tour';
        return;
      }

      this.isLoading = true;
      this.errorMessage = '';

      // Lưu package_id trước khi destructure
      const packageId = this.currentTour.package_id;

      // Xử lý upload ảnh nếu có thay đổi (thêm/xóa/đổi thứ tự)
      if (this.hasImageChanges || this.selectedFiles.length > 0) {
        try {
          // Kiểm tra xem có xóa ảnh cũ không
          const hasDeletedOldImages = this.imageUrls.length < this.originalImageCount;

          // Kiểm tra xem có đổi thứ tự không (so sánh với thứ tự ban đầu)
          const currentOldUrls = this.imageUrls.filter(url => this.originalImageUrls.includes(url));
          const hasReorderedImages = currentOldUrls.some((url, index) =>
            this.originalImageUrls[index] !== url
          );

          // Kiểm tra có thêm ảnh mới không
          const hasNewImages = this.selectedFiles.length > 0;

          // TH1: Chỉ đổi thứ tự ảnh cũ (không thêm, không xóa)
          if (hasReorderedImages && !hasNewImages && !hasDeletedOldImages) {
            // Chỉ cần cập nhật image_urls với thứ tự mới, không cần upload
            this.currentTour.image_urls = this.imageUrls.join('|');
          }
          // TH2: Có xóa ảnh hoặc thêm ảnh mới
          else if (hasDeletedOldImages || hasNewImages) {
            let filesToUpload: File[] = [];
            let shouldReplace = false;

            // Nếu có xóa ảnh cũ HOẶC (đổi thứ tự + thêm ảnh mới)
            if (hasDeletedOldImages || hasReorderedImages) {
              // Lấy các ảnh cũ còn giữ theo đúng thứ tự hiện tại trong imageUrls
              const remainingOldUrls = this.imageUrls.filter(url =>
                this.originalImageUrls.includes(url)
              );

              if (remainingOldUrls.length > 0) {
                // Download các ảnh cũ còn giữ theo đúng thứ tự đã sắp xếp
                const downloadedFiles = await Promise.all(
                  remainingOldUrls.map((url) => {
                    // Lấy tên file gốc từ URL Cloudinary
                    const urlParts = url.split('/');
                    const filename = urlParts[urlParts.length - 1].split('?')[0];
                    return this.downloadImageAsFile(url, filename);
                  })
                );

                // Thêm ảnh cũ vào đầu, ảnh mới vào sau
                filesToUpload = [...downloadedFiles, ...this.selectedFiles];
              } else {
                // Không còn ảnh cũ, chỉ có ảnh mới
                filesToUpload = [...this.selectedFiles];
              }
              shouldReplace = true; // Phải replace vì đã có thay đổi
            } else {
              // Chỉ thêm ảnh mới, không xóa và không đổi thứ tự
              filesToUpload = [...this.selectedFiles];
              shouldReplace = false; // Chỉ append vào cuối
            }

            // Upload nếu có file
            if (filesToUpload.length > 0) {
              const uploadResult = await this.tourService.manageImages(
                packageId,
                filesToUpload,
                shouldReplace
              );

              // Cập nhật URL mới từ backend
              if (uploadResult && uploadResult.image_urls) {
                this.currentTour.image_urls = uploadResult.image_urls.join('|');
              }
            }
          }
        } catch (uploadError: any) {
          console.error('Error uploading images:', uploadError);
          // Không dừng lại khi upload ảnh fail, vẫn tiếp tục update tour info
          this.errorMessage = 'Cảnh báo: Không thể upload ảnh mới. Các thông tin khác vẫn được cập nhật.';
        }
      }

      // Loại bỏ các field không cần thiết
      // Nếu chỉ đổi thứ tự ảnh, giữ lại image_urls để gửi lên
      const { package_id, created_at, updated_at, ...updateData } = this.currentTour;

      await this.tourService.updateTourPackage(packageId, updateData);
      await this.loadTours();
      this.closeEditModal();
      await this.dialogService.alert('Thành công', 'Cập nhật tour thành công!');
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể cập nhật tour';
      await this.dialogService.alert('Lỗi', this.errorMessage);
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
      await this.dialogService.alert('Thành công', 'Xóa tour thành công!');
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể xóa tour';
      await this.dialogService.alert('Lỗi', this.errorMessage);
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
      const newStatus = !tour.is_active;
      await this.tourService.updateTourPackage(tour.package_id, {
        is_active: newStatus
      });
      await this.loadTours();
      await this.dialogService.alert('Thành công', `Đã ${newStatus ? 'kích hoạt' : 'vô hiệu hóa'} tour thành công!`);
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể cập nhật trạng thái';
      await this.dialogService.alert('Lỗi', this.errorMessage);
      console.error('Toggle status error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Utilities
  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('vi-VN');
  }

  getImageUrl(imageUrls: string): string {
    return imageUrls.split('|')[0] || 'https://via.placeholder.com/300x200';
  }

  // Image handling methods
  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      const validFiles = files.filter(file => {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        return validTypes.includes(file.type);
      });

      if (validFiles.length !== files.length) {
        this.dialogService.warning('File không hợp lệ', 'Chỉ chấp nhận file ảnh định dạng JPEG, JPG, PNG, WebP');
      }

      // Add new files
      this.selectedFiles.push(...validFiles);
      this.hasImageChanges = true; // Đánh dấu có thay đổi

      // Create preview URLs
      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.imageUrls.push(e.target.result);
        };
        reader.readAsDataURL(file);
      });
    }
  }

  removeImage(index: number) {
    // Xác định số ảnh cũ từ server (không phải ảnh mới upload)
    const oldImagesCount = this.originalImageUrls.length;
    
    // Nếu xóa ảnh cũ từ server
    if (index < oldImagesCount) {
      // Chỉ xóa khỏi imageUrls, không xóa khỏi selectedFiles
      this.imageUrls.splice(index, 1);
    } else {
      // Nếu xóa ảnh mới (vừa upload)
      const newFileIndex = index - oldImagesCount;
      if (newFileIndex >= 0 && newFileIndex < this.selectedFiles.length) {
        this.selectedFiles.splice(newFileIndex, 1);
      }
      this.imageUrls.splice(index, 1);
    }
    
    this.hasImageChanges = true; // Đánh dấu có thay đổi
  }

  onDragStart(index: number) {
    this.draggedImageIndex = index;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    if (this.draggedImageIndex === null) return;

    // Reorder imageUrls array
    const draggedUrl = this.imageUrls[this.draggedImageIndex];
    this.imageUrls.splice(this.draggedImageIndex, 1);
    this.imageUrls.splice(dropIndex, 0, draggedUrl);

    // Reorder selectedFiles if applicable
    const newFileStartIndex = this.imageUrls.length - this.selectedFiles.length;
    if (this.draggedImageIndex >= newFileStartIndex && dropIndex >= newFileStartIndex) {
      const draggedFileIndex = this.draggedImageIndex - newFileStartIndex;
      const dropFileIndex = dropIndex - newFileStartIndex;
      const draggedFile = this.selectedFiles[draggedFileIndex];
      this.selectedFiles.splice(draggedFileIndex, 1);
      this.selectedFiles.splice(dropFileIndex, 0, draggedFile);
    }

    this.hasImageChanges = true; // Đánh dấu có thay đổi thứ tự ảnh
    this.draggedImageIndex = null;
  }

  onDragEnd() {
    this.draggedImageIndex = null;
  }

  onManualUrlChange(urlString: string) {
    this.imageUrls = (urlString || '').split('|').filter(url => url.trim());
  }

  // Download ảnh từ URL thành File object
  async downloadImageAsFile(url: string, filename: string): Promise<File> {
    const response = await fetch(url);
    const blob = await response.blob();

    // Lấy extension từ URL gốc hoặc từ blob type
    let extension = '.jpg'; // default
    const urlParts = url.split('.');
    if (urlParts.length > 1) {
      const urlExt = urlParts[urlParts.length - 1].split('?')[0].toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt)) {
        extension = '.' + urlExt;
      }
    }

    // Hoặc lấy từ blob type
    if (blob.type === 'image/jpeg') extension = '.jpg';
    else if (blob.type === 'image/png') extension = '.png';
    else if (blob.type === 'image/webp') extension = '.webp';

    const finalFilename = filename.replace(/\.[^.]+$/, '') + extension;
    return new File([blob], finalFilename, { type: blob.type });
  }

  // Format price input with thousand separator
  onPriceInput(event: any) {
    const input = event.target.value.replace(/\D/g, ''); // Remove non-digits
    this.currentTour.price = parseInt(input) || 0;
    this.formattedPrice = this.formatNumberWithCommas(this.currentTour.price);
  }

  formatNumberWithCommas(value: number): string {
    if (!value) return '';
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  // Format datetime for display
  formatDateTime(datetime: string): string {
    if (!datetime) return 'N/A';
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(datetime));
  }

  // Copy to clipboard
  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      await this.dialogService.alert('Thành công', 'Đã copy vào clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      await this.dialogService.alert('Lỗi', 'Không thể copy vào clipboard!');
    }
  }

  // Bulk CSV Upload
  openBulkUploadModal() {
    this.showBulkUploadModal = true;
    this.selectedCSVFile = null;
    this.bulkUploadResult = null;
  }

  closeBulkUploadModal() {
    this.showBulkUploadModal = false;
    this.selectedCSVFile = null;
    this.bulkUploadResult = null;
  }

  onCSVFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        this.selectedCSVFile = file;
      } else {
        this.dialogService.warning('File không hợp lệ', 'Vui lòng chọn file CSV!');
        input.value = '';
      }
    }
  }

  async uploadCSV() {
    if (!this.selectedCSVFile) {
      await this.dialogService.warning('Chưa chọn file', 'Vui lòng chọn file CSV!');
      return;
    }

    this.isLoading = true;
    try {
      const result = await this.tourService.createTourPackagesFromCSV(this.selectedCSVFile);
      this.bulkUploadResult = result;

      if (result.EC === 0) {
        await this.dialogService.alert('Upload thành công!', `${result.successful} tour được tạo, ${result.failed} thất bại.`);
        if (result.successful > 0) {
          await this.loadTours(); // Reload danh sách tour
        }
      } else {
        await this.dialogService.alert('Lỗi', `Có lỗi xảy ra: ${result.EM}`);
      }
    } catch (error: any) {
      console.error('Error uploading CSV:', error);
      await this.dialogService.alert('Lỗi', 'Lỗi khi upload file CSV!');
    } finally {
      this.isLoading = false;
    }
  }

  downloadCSVTemplate() {
    const template = `package_name,destination,description,duration_days,price,available_slots,start_date,end_date,image_urls,cuisine,suitable_for,is_active
Tour Mẫu Hà Nội,Hà Nội,Khám phá thủ đô ngàn năm văn hiến,3,5000000,20,2026-05-01,2026-05-04,https://example.com/img1.jpg|https://example.com/img2.jpg,Phở Hà Nội|Bún Chả,Gia đình|Cặp đôi,true
Tour Mẫu Đà Nẵng,Đà Nẵng,Thành phố đáng sống nhất Việt Nam,4,7000000,15,2026-06-10,2026-06-14,https://example.com/img3.jpg,Mì Quảng|Bánh Tráng Cuốn Thịt Heo,Nhóm bạn|Gia đình,true`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'tour_template.csv';
    link.click();
  }

  // Individual filter methods

  // Date Filter
  async applyDateFilter() {
    if (!this.startDateFilter || !this.endDateFilter) {
      await this.dialogService.warning('Thiếu thông tin', 'Vui lòng chọn cả ngày bắt đầu và ngày kết thúc!');
      return;
    }

    if (this.startDateFilter > this.endDateFilter) {
      await this.dialogService.warning('Ngày không hợp lệ', 'Ngày bắt đầu phải trước ngày kết thúc!');
      return;
    }

    try {
      this.isLoading = true;
      this.errorMessage = '';

      const isActive = this.statusFilter ? this.statusFilter === 'active' : undefined;
      const response = await this.tourService.filterToursByDate(
        this.startDateFilter,
        this.endDateFilter,
        isActive
      );

      this.tours = response.packages || [];
      this.isDateFilterActive = true;
      
      // Apply basic filters on the result
      this.filteredTours = this.tours.filter(tour => {
        const matchesSearch = !this.searchTerm ||
          tour.package_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          tour.destination.toLowerCase().includes(this.searchTerm.toLowerCase());

        const matchesDestination = !this.destinationFilter ||
          tour.destination.toLowerCase().includes(this.destinationFilter.toLowerCase());

        return matchesSearch && matchesDestination;
      });
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể áp dụng bộ lọc theo ngày';
      console.error('Apply date filter error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  clearDateFilter() {
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.isDateFilterActive = false;
    this.loadTours();
  }

  // Period Filter (Month/Year combined)
  async applyPeriodFilter() {
    try {
      if (!this.periodMonthFilter && !this.periodYearFilter) {
        this.errorMessage = 'Vui lòng nhập tháng hoặc năm';
        return;
      }

      this.isLoading = true;
      this.errorMessage = '';

      const isActive = this.statusFilter ? this.statusFilter === 'active' : undefined;
      let response: any;

      // If both month and year are provided, filter by month
      if (this.periodMonthFilter && this.periodYearFilter) {
        response = await this.tourService.filterToursByMonth(
          Number(this.periodMonthFilter),
          Number(this.periodYearFilter),
          this.periodDateTypeFilter,
          isActive
        );
      }
      // If only year is provided, filter by year
      else if (this.periodYearFilter) {
        response = await this.tourService.filterToursByYear(
          Number(this.periodYearFilter),
          this.periodDateTypeFilter,
          isActive
        );
      }

      this.tours = response.packages || [];
      this.isPeriodFilterActive = true;
      
      // Apply basic filters on the result
      this.filteredTours = this.tours.filter(tour => {
        const matchesSearch = !this.searchTerm ||
          tour.package_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          tour.destination.toLowerCase().includes(this.searchTerm.toLowerCase());

        const matchesDestination = !this.destinationFilter ||
          tour.destination.toLowerCase().includes(this.destinationFilter.toLowerCase());

        return matchesSearch && matchesDestination;
      });
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể áp dụng bộ lọc';
      console.error('Apply period filter error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  clearPeriodFilter() {
    this.periodMonthFilter = '';
    this.periodYearFilter = '';
    this.periodDateTypeFilter = 'start_date';
    this.isPeriodFilterActive = false;
    this.loadTours();
  }

  // Price Filter
  async applyPriceFilter() {
    try {
      if (!this.priceSegmentFilter) {
        this.errorMessage = 'Vui lòng chọn phân khúc giá';
        return;
      }

      let segment: 'budget' | 'mid' | 'premium' | undefined;
      let minPrice: number | undefined;
      let maxPrice: number | undefined;

      if (this.priceSegmentFilter === 'custom') {
        minPrice = this.minPriceFilter ? Number(this.minPriceFilter) : undefined;
        maxPrice = this.maxPriceFilter ? Number(this.maxPriceFilter) : undefined;
        if (!minPrice && !maxPrice) {
          this.errorMessage = 'Vui lòng nhập giá tối thiểu hoặc tối đa';
          return;
        }
      } else {
        segment = this.priceSegmentFilter as 'budget' | 'mid' | 'premium';
      }

      this.isLoading = true;
      this.errorMessage = '';

      const isActive = this.statusFilter ? this.statusFilter === 'active' : undefined;
      const response = await this.tourService.filterToursByPriceRange(
        minPrice,
        maxPrice,
        segment,
        isActive
      );

      this.tours = response.packages || [];
      this.isPriceFilterActive = true;
      
      // Apply basic filters on the result
      this.filteredTours = this.tours.filter(tour => {
        const matchesSearch = !this.searchTerm ||
          tour.package_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          tour.destination.toLowerCase().includes(this.searchTerm.toLowerCase());

        const matchesDestination = !this.destinationFilter ||
          tour.destination.toLowerCase().includes(this.destinationFilter.toLowerCase());

        return matchesSearch && matchesDestination;
      });
    } catch (error: any) {
      this.errorMessage = error.message || 'Không thể áp dụng bộ lọc theo giá';
      console.error('Apply price filter error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  clearPriceFilter() {
    this.priceSegmentFilter = '';
    this.minPriceFilter = '';
    this.maxPriceFilter = '';
    this.isPriceFilterActive = false;
    this.loadTours();
  }

  onPriceSegmentChange() {
    if (this.priceSegmentFilter !== 'custom') {
      this.minPriceFilter = '';
      this.maxPriceFilter = '';
    }
  }

  // Slot Filter methods
  applySlotFilter() {
    if (!this.minSlotFilter && !this.maxSlotFilter) {
      this.errorMessage = 'Vui lòng nhập số slot tối thiểu hoặc tối đa';
      return;
    }

    this.isSlotFilterActive = true;
  }

  clearSlotFilter() {
    this.minSlotFilter = '';
    this.maxSlotFilter = '';
    this.isSlotFilterActive = false;
    this.loadTours();
  }

  // Stats methods
  getActiveTours(): number {
    return this.tours.filter(tour => tour.is_active).length;
  }

  getInactiveTours(): number {
    return this.tours.filter(tour => !tour.is_active).length;
  }

  getAveragePrice(): string {
    if (this.tours.length === 0) return '0 ₫';
    const total = this.tours.reduce((sum, tour) => sum + tour.price, 0);
    const average = total / this.tours.length;
    return this.formatPrice(average);
  }

  // Preview helper methods
  formatPreviewPrice(price: number): string {
    if (!price) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  formatPreviewDate(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  /**
   * Confirm and cancel a tour package
   * This will cancel all related bookings and notify users
   */
  async confirmCancelTour(packageId: string) {
    const confirmed = await this.dialogService.confirm({
      title: 'Hủy Tour Package',
      message: 'Bạn có chắc chắn muốn HỦY tour này?\n\n⚠️ Lưu ý:\n- Tất cả bookings (pending/confirmed) sẽ bị hủy\n- Các khách hàng sẽ nhận thông báo\n- Tour sẽ bị tạm dừng (is_active = false)',
      confirmText: 'Hủy Tour',
      cancelText: 'Không',
      type: 'warning'
    });

    if (!confirmed) return;

    // Ask for reason
    const reason = prompt('Nhập lý do hủy tour (ví dụ: Thiên tai, Hết chỗ, v.v.):');
    if (reason === null) return; // User clicked cancel

    this.isLoading = true;
    try {
      const result = await this.tourService.cancelTourPackage(packageId, reason || undefined);

      await this.dialogService.alert(
        'Hủy Tour Thành Công',
        `✅ Tour đã bị hủy\n📋 Số bookings đã hủy: ${result.cancelled_bookings}\n🔔 Thông báo đã gửi: ${result.notifications_sent}`
      );

      await this.loadTours();
    } catch (error: any) {
      console.error('Error cancelling tour:', error);
      await this.dialogService.alert('Lỗi', error.message || 'Không thể hủy tour');
    } finally {
      this.isLoading = false;
    }
  }
}
