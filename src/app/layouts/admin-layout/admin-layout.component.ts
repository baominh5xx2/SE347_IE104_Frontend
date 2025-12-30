import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AdminDialogService } from '../../services/admin/admin-dialog.service';
import { AdminDialogComponent } from '../../shared/admin-dialog/admin-dialog.component';
import { AdminChatbotComponent } from '../../components/admin-chatbot/admin-chatbot.component';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminDialogComponent, AdminChatbotComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss'
})
export class AdminLayoutComponent implements OnInit {
  showDropdown = false;
  showChatbot = false;
  adminProfilePicture: string | null = null;
  adminName: string = 'Admin';

  constructor(
    private router: Router,
    private dialogService: AdminDialogService,
    private authStateService: AuthStateService
  ) {}

  ngOnInit() {
    this.loadAdminProfile();
  }

  loadAdminProfile() {
    try {
      const adminData = localStorage.getItem('admin');
      if (adminData) {
        const admin = JSON.parse(adminData);
        this.adminProfilePicture = admin.profile_picture || null;
        this.adminName = admin.full_name || admin.email || 'Admin';
      }
    } catch (error) {
      console.error('Error loading admin profile:', error);
    }
  }

  getAdminInitial(): string {
    return this.adminName.charAt(0).toUpperCase();
  }

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }

  closeDropdown() {
    this.showDropdown = false;
  }

  toggleChatbot() {
    this.showChatbot = !this.showChatbot;
  }

  closeChatbot() {
    this.showChatbot = false;
  }

  async logout() {
    const confirmed = await this.dialogService.confirm({
      title: 'Đăng xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?',
      confirmText: 'Đăng xuất',
      cancelText: 'Hủy',
      type: 'warning'
    });

    if (confirmed) {
      this.showDropdown = false;
      // Clear all auth state (localStorage + service state)
      this.authStateService.logout();
      // Navigate to home page
      this.router.navigate(['/home']);
    }
  }
}
