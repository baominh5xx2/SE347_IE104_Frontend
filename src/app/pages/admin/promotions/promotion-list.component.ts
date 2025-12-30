import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPromotionService, PromotionCreateRequest, PromotionUpdateRequest } from '../../../services/admin/admin-promotion.service';
import type { Promotion } from '../../../services/admin/admin-promotion.service';

@Component({
  selector: 'app-promotion-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promotion-list.component.html',
  styleUrl: './promotion-list.component.scss'
})
export class PromotionListComponent implements OnInit {
  promotions: Promotion[] = [];
  filteredPromotions: Promotion[] = [];

  currentPromotion: Partial<Promotion> = {};
  editPromotion: Partial<Promotion> | null = null;
  originalEditPromotion: Partial<Promotion> | null = null;
  displayDiscountValue: string = '';
  displayEditDiscountValue: string = '';
  validationErrors = {
    name: '',
    description: '',
    discount_value: '',
    start_date: '',
    end_date: '',
    quantity: ''
  };
  deleteId: string = '';
  showDeleteModal: boolean = false;
  showErrorModal: boolean = false;
  
  searchTerm = '';
  statusFilter: string = '';
  
  // Advanced Filters
  showAdvancedFilters = false;
  
  // Discount filter
  discountTypeFilter: string = ''; // '', 'PERCENTAGE', 'FIXED_AMOUNT'
  minDiscountFilter: number | '' = '';
  maxDiscountFilter: number | '' = '';
  isDiscountFilterActive = false;
  
  // Date range filter
  startDateFilter = '';
  endDateFilter = '';
  isDateRangeFilterActive = false;
  
  // Quantity filter
  minQuantityFilter: number | '' = '';
  maxQuantityFilter: number | '' = '';
  isQuantityFilterActive = false;
  
  // User count filter
  minUserCountFilter: number | '' = '';
  maxUserCountFilter: number | '' = '';
  isUserCountFilterActive = false;
  
  showAddModal = false;
  showEditModal = false;
  showSuccessModal = false;

  isCreatePromotionFormValid(): boolean {
    // Check all required fields for create form
    const p = this.currentPromotion;
    if (!p) return false;
    if (!p.name || !p.name.trim() || p.name.length > 20) return false;
    if (!p.description || !p.description.trim() || p.description.length > 100) return false;
    if (!p.discount_type || (p.discount_type !== 'PERCENTAGE' && p.discount_type !== 'FIXED_AMOUNT')) return false;
    if (!p.discount_value || p.discount_value <= 0) return false;
    if (p.discount_type === 'PERCENTAGE' && p.discount_value > 100) return false;
    if (p.discount_type === 'FIXED_AMOUNT' && p.discount_value > 1000000000) return false;
    if (!p.start_date) return false;
    if (!p.end_date) return false;
    if (p.start_date && p.end_date && new Date(p.start_date) >= new Date(p.end_date)) return false;
    if (!p.quantity || p.quantity <= 0 || p.quantity > 1000000) return false;
    if (typeof p.is_active !== 'boolean') return false;
    return true;
  }
  
  editValidationErrors = {
    name: '',
    description: '',
    discount_value: '',
    start_date: '',
    end_date: '',
    quantity: ''
  };
  
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private promotionService: AdminPromotionService) {}

  ngOnInit() {
    if (this.loadPromotions) {
      this.loadPromotions();
    }
  }

  loadPromotions() {
    this.isLoading = true;
    this.errorMessage = '';
    
    const params: any = {};
    if (this.statusFilter === 'active') {
      params.is_active = true;
    } else if (this.statusFilter === 'inactive') {
      params.is_active = false;
    }
    
    this.promotionService.getPromotions(params).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.promotions = response.promotions || [];
          this.applyFilters();
        } else {
          this.errorMessage = response.EM || 'Không thể tải danh sách mã khuyến mãi';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Lỗi khi tải danh sách mã khuyến mãi';
        console.error('Load promotions error:', error);
        this.isLoading = false;
      }
    });
  }

  applyFilters() {
    this.filteredPromotions = this.promotions.filter(promo => {
      // Search filter
      const matchesSearch = !this.searchTerm || 
        promo.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        promo.description.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        promo.code.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = !this.statusFilter ||
        (this.statusFilter === 'active' && promo.is_active) ||
        (this.statusFilter === 'inactive' && !promo.is_active);
      
      // Discount filter
      const matchesDiscount = !this.isDiscountFilterActive || (
        (!this.discountTypeFilter || promo.discount_type === this.discountTypeFilter) &&
        (this.minDiscountFilter === '' || promo.discount_value >= this.minDiscountFilter) &&
        (this.maxDiscountFilter === '' || promo.discount_value <= this.maxDiscountFilter)
      );
      
      // Date range filter
      const matchesDateRange = !this.isDateRangeFilterActive || (
        (!this.startDateFilter || new Date(promo.start_date) >= new Date(this.startDateFilter)) &&
        (!this.endDateFilter || new Date(promo.end_date) <= new Date(this.endDateFilter))
      );
      
      // Quantity filter
      const matchesQuantity = !this.isQuantityFilterActive || (
        (this.minQuantityFilter === '' || promo.quantity >= this.minQuantityFilter) &&
        (this.maxQuantityFilter === '' || promo.quantity <= this.maxQuantityFilter)
      );
      
      // User count filter
      const matchesUserCount = !this.isUserCountFilterActive || (
        (this.minUserCountFilter === '' || promo.used_count >= this.minUserCountFilter) &&
        (this.maxUserCountFilter === '' || promo.used_count <= this.maxUserCountFilter)
      );
      
      return matchesSearch && matchesStatus && matchesDiscount && matchesDateRange && matchesQuantity && matchesUserCount;
    });
  }

  onFilterChange() {
    // Update filter activation flags
    this.isDiscountFilterActive = !!(this.discountTypeFilter || this.minDiscountFilter || this.maxDiscountFilter);
    this.isDateRangeFilterActive = !!(this.startDateFilter || this.endDateFilter);
    this.isQuantityFilterActive = !!(this.minQuantityFilter || this.maxQuantityFilter);
    this.isUserCountFilterActive = !!(this.minUserCountFilter || this.maxUserCountFilter);
    
    this.applyFilters();
  }

  openAddModal() {
    this.currentPromotion = {
      name: '',
      description: '',
      discount_type: 'PERCENTAGE',
      discount_value: 0,
      start_date: '',
      end_date: '',
      quantity: 0,
      is_active: true
    };
    this.displayDiscountValue = '';
    this.showAddModal = true;
    this.errorMessage = '';
  }

  closeAddModal() {
    this.showAddModal = false;
    this.currentPromotion = {};
  }

  hasChanges(): boolean {
    if (!this.editPromotion || !this.originalEditPromotion) return false;
    
    return this.editPromotion.name !== this.originalEditPromotion.name ||
           this.editPromotion.description !== this.originalEditPromotion.description ||
           this.editPromotion.discount_type !== this.originalEditPromotion.discount_type ||
           this.editPromotion.discount_value !== this.originalEditPromotion.discount_value ||
           this.editPromotion.start_date !== this.originalEditPromotion.start_date ||
           this.editPromotion.end_date !== this.originalEditPromotion.end_date ||
           this.editPromotion.quantity !== this.originalEditPromotion.quantity ||
           this.editPromotion.is_active !== this.originalEditPromotion.is_active;
  }

  onEditDiscountTypeChange() {
    if (!this.editPromotion) return;
    
    // Reset discount value và display value khi đổi loại
    this.editPromotion.discount_value = 0;
    this.displayEditDiscountValue = '';
  }

  isPromotionUsed(): boolean {
    return this.editPromotion ? (this.editPromotion.used_count || 0) > 0 : false;
  }

  openEditModal(promo: Promotion) {
    this.editPromotion = { ...promo };
    this.originalEditPromotion = { ...promo };
    this.displayEditDiscountValue = promo.discount_type === 'FIXED_AMOUNT' ? this.formatNumber(promo.discount_value.toString()) : '';
    this.showEditModal = true;
    this.errorMessage = '';
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editPromotion = null;
    this.originalEditPromotion = null;
  }

  savePromotion() {
    if (!this.validatePromotion()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    
    const data: PromotionCreateRequest = {
      name: this.currentPromotion.name!,
      description: this.currentPromotion.description!,
      discount_type: this.currentPromotion.discount_type as 'PERCENTAGE' | 'FIXED_AMOUNT',
      discount_value: this.currentPromotion.discount_value!,
      start_date: this.formatDateTime(this.currentPromotion.start_date!),
      end_date: this.formatDateTime(this.currentPromotion.end_date!),
      quantity: this.currentPromotion.quantity!,
      is_active: this.currentPromotion.is_active!
    };
    
    this.promotionService.createPromotion(data).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.showSuccessModal = true;
          this.loadPromotions();
          this.closeAddModal();
        } else {
          this.errorMessage = response.EM || 'Không thể tạo mã khuyến mãi';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Lỗi khi tạo mã khuyến mãi';
        console.error('Create promotion error:', error);
        this.isLoading = false;
      }
    });
  }

  confirmDelete(promotionId: string) {
    this.deleteId = promotionId;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.deleteId = '';
  }

  deletePromotion() {
    if (!this.deleteId) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.promotionService.deletePromotion(this.deleteId).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.successMessage = 'Xóa mã khuyến mãi thành công';
          this.closeDeleteModal();
          // Reload sau khi đóng modal để tránh lỗi UI
          setTimeout(() => {
            this.loadPromotions();
          }, 100);
          setTimeout(() => this.successMessage = '', 3000);
        } else {
          this.errorMessage = response.EM || 'Không thể xóa mã khuyến mãi. Có thể mã này đã được sử dụng.';
          this.closeDeleteModal();
        }
        this.isLoading = false;
      },
      error: (error) => {
        const errorMsg = error?.error?.EM || error?.message || 'Lỗi khi xóa mã khuyến mãi. Mã này có thể đã được sử dụng bởi người dùng.';
        this.errorMessage = errorMsg;
        console.error('Delete promotion error:', error);
        this.isLoading = false;
        this.closeDeleteModal();
      }
    });
  }

  toggleStatus(promo: Promotion) {
    this.isLoading = true;
    this.errorMessage = '';

    const data: PromotionUpdateRequest = {
      is_active: !promo.is_active
    };

    this.promotionService.updatePromotion(promo.promotion_id, data).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.successMessage = 'Cập nhật trạng thái thành công';
          this.loadPromotions();
          setTimeout(() => this.successMessage = '', 3000);
        } else {
          this.errorMessage = response.EM || 'Không thể cập nhật trạng thái';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Lỗi khi cập nhật trạng thái';
        console.error('Toggle status error:', error);
        this.isLoading = false;
      }
    });
  }

  validatePromotion(): boolean {
    let isValid = true;
    this.validationErrors = {
      name: '',
      description: '',
      discount_value: '',
      start_date: '',
      end_date: '',
      quantity: ''
    };

    if (!this.currentPromotion.name?.trim()) {
      this.validationErrors.name = 'Vui lòng nhập tên mã khuyến mãi';
      isValid = false;
    } else if (this.currentPromotion.name.length > 20) {
      this.validationErrors.name = 'Tên mã không quá 20 ký tự';
      isValid = false;
    }

    if (!this.currentPromotion.description?.trim()) {
      this.validationErrors.description = 'Vui lòng nhập mô tả';
      isValid = false;
    } else if (this.currentPromotion.description.length > 100) {
      this.validationErrors.description = 'Mô tả không quá 100 chữ';
      isValid = false;
    }

    if (!this.currentPromotion.discount_value || this.currentPromotion.discount_value <= 0) {
      this.validationErrors.discount_value = 'Giá trị giảm giá phải lớn hơn 0';
      isValid = false;
    } else if (this.currentPromotion.discount_type === 'PERCENTAGE' && this.currentPromotion.discount_value > 100) {
      this.validationErrors.discount_value = 'Giảm giá phần trăm không quá 100%';
      isValid = false;
    }

    if (!this.currentPromotion.start_date) {
      this.validationErrors.start_date = 'Vui lòng chọn ngày bắt đầu';
      isValid = false;
    }

    if (!this.currentPromotion.end_date) {
      this.validationErrors.end_date = 'Vui lòng chọn ngày kết thúc';
      isValid = false;
    } else if (this.currentPromotion.start_date && new Date(this.currentPromotion.start_date) >= new Date(this.currentPromotion.end_date)) {
      this.validationErrors.end_date = 'Ngày kết thúc phải lớn hơn ngày bắt đầu';
      isValid = false;
    }

    if (!this.currentPromotion.quantity || this.currentPromotion.quantity <= 0) {
      this.validationErrors.quantity = 'Số lượng phải lớn hơn 0';
      isValid = false;
    } else if (this.currentPromotion.quantity > 1000000) {
      this.validationErrors.quantity = 'Số lượng không quá 1,000,000';
      isValid = false;
    }

    return isValid;
  }

  // Validate while typing
  onNameInput() {
    this.validationErrors.name = '';
    if (this.currentPromotion.name && this.currentPromotion.name.length > 20) {
      this.currentPromotion.name = this.currentPromotion.name.substring(0, 20);
    }
  }

  onDescriptionInput() {
    this.validationErrors.description = '';
    if (this.currentPromotion.description && this.currentPromotion.description.length > 100) {
      this.currentPromotion.description = this.currentPromotion.description.substring(0, 100);
    }
  }

  formatNumber(value: string): string {
    // Remove all non-digit characters
    let numStr = value.replace(/\D/g, '');
    if (!numStr) return '';
    
    // Limit to 10 digits (1 billion = 1,000,000,000)
    if (numStr.length > 10) {
      numStr = numStr.substring(0, 10);
    }
    
    // Convert to number and check max value
    const num = parseInt(numStr, 10);
    if (num > 1000000000) {
      numStr = '1000000000';
    }
    
    // Add thousand separators
    return numStr.replace(/(\d)(?=(\d{3})+$)/g, '$1.');
  }

  parseFormattedNumber(value: string): number {
    // Remove all dots and parse to number
    const numStr = value.replace(/\./g, '');
    return numStr ? parseInt(numStr, 10) : 0;
  }

  onDiscountValueInput(event?: Event) {
    this.validationErrors.discount_value = '';
    
    if (this.currentPromotion.discount_type === 'FIXED_AMOUNT') {
      // For FIXED type, format with thousand separators
      const input = event?.target as HTMLInputElement;
      if (input) {
        const cursorPos = input.selectionStart || 0;
        const oldValue = this.displayDiscountValue;
        const oldLength = oldValue.length;
        
        // Remove all non-digit characters
        let rawValue = input.value.replace(/\D/g, '');
        
        // Limit to 10 digits maximum
        if (rawValue.length > 10) {
          rawValue = rawValue.substring(0, 10);
        }
        
        // Parse and validate
        let numValue = rawValue ? parseInt(rawValue, 10) : 0;
        if (numValue > 1000000000) {
          numValue = 1000000000;
        }
        if (numValue < 0) {
          numValue = 0;
        }
        
        // Update both values
        this.currentPromotion.discount_value = numValue;
        this.displayDiscountValue = this.formatNumber(numValue.toString());
        
        // Restore cursor position
        const newLength = this.displayDiscountValue.length;
        const diff = newLength - oldLength;
        const newCursorPos = Math.max(0, cursorPos + diff);
        
        setTimeout(() => {
          input.value = this.displayDiscountValue;
          input.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }
    } else {
      // For PERCENTAGE type, normal number validation
      setTimeout(() => {
        if (this.currentPromotion.discount_value) {
          if (this.currentPromotion.discount_value > 100) {
            this.currentPromotion.discount_value = 100;
          }
          if (this.currentPromotion.discount_value < 0) {
            this.currentPromotion.discount_value = 0;
          }
        }
      }, 0);
    }
  }

  onQuantityInput() {
    this.validationErrors.quantity = '';
    setTimeout(() => {
      if (this.currentPromotion.quantity) {
        if (this.currentPromotion.quantity > 1000000) {
          this.currentPromotion.quantity = 1000000;
        }
        if (this.currentPromotion.quantity < 1) {
          this.currentPromotion.quantity = 1;
        }
      }
    }, 0);
  }

  onEndDateChange() {
    this.validationErrors.end_date = '';
    if (this.currentPromotion.start_date && this.currentPromotion.end_date) {
      if (new Date(this.currentPromotion.start_date) >= new Date(this.currentPromotion.end_date)) {
        this.validationErrors.end_date = 'Ngày kết thúc phải lớn hơn ngày bắt đầu';
      }
    }
  }

  updatePromotion() {
    if (!this.validateEditPromotion()) {
      return;
    }

    if (!this.editPromotion) return;

    // Ensure promotion_id exists before updating
    if (!this.editPromotion.promotion_id) {
      this.errorMessage = 'Không tìm thấy ID của mã khuyến mãi để cập nhật.';
      this.showErrorModal = true;
      setTimeout(() => this.showErrorModal = false, 2500);
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const data: PromotionUpdateRequest = {
      name: this.editPromotion.name,
      description: this.editPromotion.description,
      discount_type: this.editPromotion.discount_type as 'PERCENTAGE' | 'FIXED_AMOUNT',
      discount_value: this.editPromotion.discount_value,
      start_date: this.formatDateTime(this.editPromotion.start_date || ''),
      end_date: this.formatDateTime(this.editPromotion.end_date || ''),
      quantity: this.editPromotion.quantity,
      is_active: this.editPromotion.is_active
    };

    console.log('🔄 Updating promotion with data:', data);
    console.log('📝 Original promotion:', this.originalEditPromotion);
    console.log('✏️ Edited promotion:', this.editPromotion);

    this.promotionService.updatePromotion(this.editPromotion.promotion_id, data).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.loadPromotions();
          this.closeEditModal();
          this.showSuccessModal = true;
          setTimeout(() => this.showSuccessModal = false, 2500);
        } else {
          this.errorMessage = response.EM || 'Không thể cập nhật mã khuyến mãi';
          this.showErrorModal = true;
          setTimeout(() => this.showErrorModal = false, 2500);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Update promotion error - Full error:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        console.error('Error error:', error.error);
        
        if (error.error?.detail) {
          this.errorMessage = error.error.detail;
        } else if (error.error?.EM) {
          this.errorMessage = error.error.EM;
        } else {
          this.errorMessage = 'Lỗi khi cập nhật mã khuyến mãi';
        }
        
        this.showErrorModal = true;
        setTimeout(() => this.showErrorModal = false, 2500);
        this.isLoading = false;
      }
    });
  }

  validateEditPromotion(): boolean {
    if (!this.editPromotion) return false;

    let isValid = true;
    this.editValidationErrors = {
      name: '',
      description: '',
      discount_value: '',
      start_date: '',
      end_date: '',
      quantity: ''
    };

    if (!this.editPromotion.name?.trim()) {
      this.editValidationErrors.name = 'Vui lòng nhập tên mã khuyến mãi';
      isValid = false;
    } else if (this.editPromotion.name.length > 20) {
      this.editValidationErrors.name = 'Tên mã không quá 20 ký tự';
      isValid = false;
    }

    if (!this.editPromotion.description?.trim()) {
      this.editValidationErrors.description = 'Vui lòng nhập mô tả';
      isValid = false;
    } else if (this.editPromotion.description.length > 100) {
      this.editValidationErrors.description = 'Mô tả không quá 100 chữ';
      isValid = false;
    }

    if (!this.editPromotion.discount_value || this.editPromotion.discount_value <= 0) {
      this.editValidationErrors.discount_value = 'Giá trị giảm giá phải lớn hơn 0';
      isValid = false;
    } else if (this.editPromotion.discount_type === 'PERCENTAGE' && this.editPromotion.discount_value > 100) {
      this.editValidationErrors.discount_value = 'Giảm giá phần trăm không quá 100%';
      isValid = false;
    }

    if (!this.editPromotion.start_date) {
      this.editValidationErrors.start_date = 'Vui lòng chọn ngày bắt đầu';
      isValid = false;
    }

    if (!this.editPromotion.end_date) {
      this.editValidationErrors.end_date = 'Vui lòng chọn ngày kết thúc';
      isValid = false;
    } else if (this.editPromotion.start_date && new Date(this.editPromotion.start_date) >= new Date(this.editPromotion.end_date)) {
      this.editValidationErrors.end_date = 'Ngày kết thúc phải lớn hơn ngày bắt đầu';
      isValid = false;
    }

    if (!this.editPromotion.quantity || this.editPromotion.quantity <= 0) {
      this.editValidationErrors.quantity = 'Số lượng phải lớn hơn 0';
      isValid = false;
    } else if (this.editPromotion.quantity > 1000000) {
      this.editValidationErrors.quantity = 'Số lượng không quá 1,000,000';
      isValid = false;
    }

    return isValid;
  }

  // Edit modal validation while typing
  onEditNameInput() {
    this.editValidationErrors.name = '';
    if (this.editPromotion && this.editPromotion.name && this.editPromotion.name.length > 20) {
      this.editPromotion.name = this.editPromotion.name.substring(0, 20);
    }
  }

  onEditDescriptionInput() {
    this.editValidationErrors.description = '';
    if (this.editPromotion && this.editPromotion.description && this.editPromotion.description.length > 100) {
      this.editPromotion.description = this.editPromotion.description.substring(0, 100);
    }
  }

  onEditDiscountValueInput(event?: Event) {
    this.editValidationErrors.discount_value = '';
    
    if (this.editPromotion && this.editPromotion.discount_type === 'FIXED_AMOUNT') {
      // For FIXED type, format with thousand separators
      const input = event?.target as HTMLInputElement;
      if (input) {
        const cursorPos = input.selectionStart || 0;
        const oldValue = this.displayEditDiscountValue;
        const oldLength = oldValue.length;
        
        // Remove all non-digit characters
        let rawValue = input.value.replace(/\D/g, '');
        
        // Limit to 10 digits maximum
        if (rawValue.length > 10) {
          rawValue = rawValue.substring(0, 10);
        }
        
        // Parse and validate
        let numValue = rawValue ? parseInt(rawValue, 10) : 0;
        if (numValue > 1000000000) {
          numValue = 1000000000;
        }
        if (numValue < 0) {
          numValue = 0;
        }
        
        // Update both values
        this.editPromotion.discount_value = numValue;
        this.displayEditDiscountValue = this.formatNumber(numValue.toString());
        
        // Restore cursor position
        const newLength = this.displayEditDiscountValue.length;
        const diff = newLength - oldLength;
        const newCursorPos = Math.max(0, cursorPos + diff);
        
        setTimeout(() => {
          input.value = this.displayEditDiscountValue;
          input.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      }
    } else {
      // For PERCENTAGE type, normal number validation
      setTimeout(() => {
        if (this.editPromotion && this.editPromotion.discount_value) {
          if (this.editPromotion.discount_value > 100) {
            this.editPromotion.discount_value = 100;
          }
          if (this.editPromotion.discount_value < 0) {
            this.editPromotion.discount_value = 0;
          }
        }
      }, 0);
    }
  }

  onEditQuantityInput() {
    this.editValidationErrors.quantity = '';
    setTimeout(() => {
      if (this.editPromotion && this.editPromotion.quantity) {
        if (this.editPromotion.quantity > 1000000) {
          this.editPromotion.quantity = 1000000;
        }
        if (this.editPromotion.quantity < 1) {
          this.editPromotion.quantity = 1;
        }
      }
    }, 0);
  }

  onEditEndDateChange() {
    this.editValidationErrors.end_date = '';
    if (this.editPromotion && this.editPromotion.start_date && this.editPromotion.end_date) {
      if (new Date(this.editPromotion.start_date) >= new Date(this.editPromotion.end_date)) {
        this.editValidationErrors.end_date = 'Ngày kết thúc phải lớn hơn ngày bắt đầu';
      }
    }
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString();
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('vi-VN');
  }

  formatDiscount(promo: Promotion): string {
    if (promo.discount_type === 'PERCENTAGE') {
      return `Giảm ${promo.discount_value}%`;
    } else {
      return `Giảm ${this.formatPrice(promo.discount_value)}`;
    }
  }

  // Stats methods
  getActivePromotions(): number {
    return this.promotions.filter(promo => promo.is_active).length;
  }

  getInactivePromotions(): number {
    return this.promotions.filter(promo => !promo.is_active).length;
  }

  getAverageDiscount(): string {
    if (this.promotions.length === 0) return '0%';
    
    const percentagePromotions = this.promotions.filter(p => p.discount_type === 'PERCENTAGE');
    if (percentagePromotions.length === 0) return 'N/A';
    
    const total = percentagePromotions.reduce((sum, promo) => sum + promo.discount_value, 0);
    const average = total / percentagePromotions.length;
    return `${average.toFixed(1)}%`;
  }

  // Advanced Filter Methods
  applyDiscountFilter() {
    if (!this.minDiscountFilter && !this.maxDiscountFilter) {
      this.errorMessage = 'Vui lòng nhập giá trị giảm tối thiểu hoặc tối đa';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const params: any = { limit: 100 };

    if (this.minDiscountFilter) params.min_discount_value = Number(this.minDiscountFilter);
    if (this.maxDiscountFilter) params.max_discount_value = Number(this.maxDiscountFilter);
    if (this.statusFilter === 'active') params.is_active = true;
    else if (this.statusFilter === 'inactive') params.is_active = false;

    this.promotionService.filterByDiscount(params).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.promotions = response.promotions || [];
          this.applyFilters();
          this.isDiscountFilterActive = true;
        } else {
          this.errorMessage = response.EM || 'Không thể lọc theo giá trị giảm';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Lỗi khi lọc theo giá trị giảm';
        console.error('Filter by discount error:', error);
        this.isLoading = false;
      }
    });
  }

  clearDiscountFilter() {
    this.discountTypeFilter = '';
    this.minDiscountFilter = '';
    this.maxDiscountFilter = '';
    this.isDiscountFilterActive = false;
    this.loadPromotions();
  }

  applyDateRangeFilter() {
    if (!this.startDateFilter && !this.endDateFilter) {
      this.errorMessage = 'Vui lòng nhập ngày bắt đầu hoặc ngày kết thúc';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const params: any = { limit: 100 };

    if (this.startDateFilter) params.start_date = this.startDateFilter;
    if (this.endDateFilter) params.end_date = this.endDateFilter;
    if (this.statusFilter === 'active') params.is_active = true;
    else if (this.statusFilter === 'inactive') params.is_active = false;

    this.promotionService.filterByDateRange(params).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.promotions = response.promotions || [];
          this.applyFilters();
          this.isDateRangeFilterActive = true;
        } else {
          this.errorMessage = response.EM || 'Không thể lọc theo ngày';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Lỗi khi lọc theo ngày';
        console.error('Filter by date range error:', error);
        this.isLoading = false;
      }
    });
  }

  clearDateRangeFilter() {
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.isDateRangeFilterActive = false;
    this.loadPromotions();
  }

  applyQuantityFilter() {
    if (!this.minQuantityFilter && !this.maxQuantityFilter) {
      this.errorMessage = 'Vui lòng nhập số lượng tối thiểu hoặc tối đa';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const params: any = { limit: 100 };

    if (this.minQuantityFilter) params.min_quantity = Number(this.minQuantityFilter);
    if (this.maxQuantityFilter) params.max_quantity = Number(this.maxQuantityFilter);
    if (this.statusFilter === 'active') params.is_active = true;
    else if (this.statusFilter === 'inactive') params.is_active = false;

    this.promotionService.filterByQuantity(params).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.promotions = response.promotions || [];
          this.applyFilters();
          this.isQuantityFilterActive = true;
        } else {
          this.errorMessage = response.EM || 'Không thể lọc theo số lượng';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Lỗi khi lọc theo số lượng';
        console.error('Filter by quantity error:', error);
        this.isLoading = false;
      }
    });
  }

  clearQuantityFilter() {
    this.minQuantityFilter = '';
    this.maxQuantityFilter = '';
    this.isQuantityFilterActive = false;
    this.loadPromotions();
  }

  applyUserCountFilter() {
    if (!this.minUserCountFilter && !this.maxUserCountFilter) {
      this.errorMessage = 'Vui lòng nhập số lượt sử dụng tối thiểu hoặc tối đa';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const params: any = { limit: 100 };

    if (this.minUserCountFilter) params.min_user_count = Number(this.minUserCountFilter);
    if (this.maxUserCountFilter) params.max_user_count = Number(this.maxUserCountFilter);
    if (this.statusFilter === 'active') params.is_active = true;
    else if (this.statusFilter === 'inactive') params.is_active = false;

    this.promotionService.filterByUserCount(params).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.promotions = response.promotions || [];
          this.applyFilters();
          this.isUserCountFilterActive = true;
        } else {
          this.errorMessage = response.EM || 'Không thể lọc theo lượt sử dụng';
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Lỗi khi lọc theo lượt sử dụng';
        console.error('Filter by user count error:', error);
        this.isLoading = false;
      }
    });
  }

  clearUserCountFilter() {
    this.minUserCountFilter = '';
    this.maxUserCountFilter = '';
    this.isUserCountFilterActive = false;
    this.loadPromotions();
  }
}



