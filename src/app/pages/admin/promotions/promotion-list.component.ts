import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromotionService, Promotion, PromotionCreateRequest } from '../../../services/promotion.service';

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
  
  searchTerm = '';
  statusFilter: string = '';
  
  showAddModal = false;
  showEditModal = false;
  showDeleteModal = false;
  
  currentPromotion: Partial<PromotionCreateRequest> = {};
  deleteId = '';
  
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private promotionService: PromotionService) {}

  ngOnInit() {
    this.loadPromotions();
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
      const matchesSearch = !this.searchTerm || 
        promo.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        promo.description.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }

  onFilterChange() {
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
    this.showAddModal = true;
    this.errorMessage = '';
  }

  closeAddModal() {
    this.showAddModal = false;
    this.currentPromotion = {};
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
      discount_type: this.currentPromotion.discount_type as 'PERCENTAGE' | 'FIXED',
      discount_value: this.currentPromotion.discount_value!,
      start_date: this.formatDateTime(this.currentPromotion.start_date!),
      end_date: this.formatDateTime(this.currentPromotion.end_date!),
      quantity: this.currentPromotion.quantity!,
      is_active: this.currentPromotion.is_active!
    };
    
    this.promotionService.createPromotion(data).subscribe({
      next: (response) => {
        if (response.EC === 0) {
          this.successMessage = 'Tạo mã khuyến mãi thành công';
          this.loadPromotions();
          this.closeAddModal();
          setTimeout(() => this.successMessage = '', 3000);
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
    this.errorMessage = 'Chức năng xóa chưa được triển khai';
    this.closeDeleteModal();
  }

  toggleStatus(promo: Promotion) {
    this.errorMessage = 'Chức năng cập nhật trạng thái chưa được triển khai';
  }

  validatePromotion(): boolean {
    if (!this.currentPromotion.name?.trim()) {
      this.errorMessage = 'Vui lòng nhập tên mã khuyến mãi';
      return false;
    }
    if (!this.currentPromotion.description?.trim()) {
      this.errorMessage = 'Vui lòng nhập mô tả';
      return false;
    }
    if (!this.currentPromotion.discount_value || this.currentPromotion.discount_value <= 0) {
      this.errorMessage = 'Giá trị giảm giá phải lớn hơn 0';
      return false;
    }
    if (this.currentPromotion.discount_type === 'PERCENTAGE' && this.currentPromotion.discount_value > 100) {
      this.errorMessage = 'Giảm giá phần trăm không được vượt quá 100%';
      return false;
    }
    if (!this.currentPromotion.start_date) {
      this.errorMessage = 'Vui lòng chọn ngày bắt đầu';
      return false;
    }
    if (!this.currentPromotion.end_date) {
      this.errorMessage = 'Vui lòng chọn ngày kết thúc';
      return false;
    }
    if (new Date(this.currentPromotion.start_date) >= new Date(this.currentPromotion.end_date)) {
      this.errorMessage = 'Ngày kết thúc phải sau ngày bắt đầu';
      return false;
    }
    if (!this.currentPromotion.quantity || this.currentPromotion.quantity <= 0) {
      this.errorMessage = 'Số lượng phải lớn hơn 0';
      return false;
    }
    return true;
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
}

