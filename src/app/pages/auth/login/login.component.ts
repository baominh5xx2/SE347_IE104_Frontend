import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { AuthStateService } from '../../../services/auth-state.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  loginMethod: 'email' | 'phone' = 'email';
  isLoading = false;
  otpSent = false;

  loginForm = {
    email: '',
    password: '',
    rememberMe: false
  };

  phoneForm = {
    phone: '',
    otp: ''
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private authStateService: AuthStateService
  ) {}

  onLogin() {
    this.isLoading = true;

    if (this.loginMethod === 'email') {
      if (this.loginForm.email && this.loginForm.password) {
        this.authService.loginWithEmail(this.loginForm.email, this.loginForm.password).subscribe({
          next: (response) => {
            console.log('Login success:', response);
            this.isLoading = false;
            if (response.EC === 0 && response.access_token) {
              localStorage.setItem('access_token', response.access_token);
              if (response.user) {
                localStorage.setItem('user', JSON.stringify(response.user));
                this.authStateService.login(response.access_token, response.user);
              }
              alert(response.EM || 'Đăng nhập thành công');
              this.router.navigate(['/home']);
            } else {
              alert(response.EM || 'Đăng nhập thất bại');
            }
          },
          error: (error) => {
            console.error('Login error:', error);
            this.isLoading = false;
            if (error.error && error.error.detail) {
              const validationErrors = error.error.detail;
              const errorMessages = validationErrors.map((err: any) => err.msg).join('\n');
              alert('Lỗi xác thực:\n' + errorMessages);
            } else {
              alert('Đăng nhập thất bại. Vui lòng thử lại.');
            }
          }
        });
      }
    } else {
      if (this.phoneForm.phone && this.phoneForm.otp) {
        this.authService.loginWithPhone(this.phoneForm.phone, this.phoneForm.otp).subscribe({
          next: (response) => {
            console.log('Phone login success:', response);
            this.isLoading = false;
            // this.router.navigate(['/home']);
          },
          error: (error) => {
            console.error('Phone login error:', error);
            this.isLoading = false;
          }
        });
      }
    }
  }

  sendOTP() {
    if (!this.phoneForm.phone) {
      return;
    }

    this.isLoading = true;
    this.authService.sendOTP(this.phoneForm.phone).subscribe({
      next: (response) => {
        console.log('OTP sent:', response);
        this.otpSent = true;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('OTP send error:', error);
        this.isLoading = false;
      }
    });
  }

  resendOTP() {
    this.otpSent = false;
    this.phoneForm.otp = '';
    this.sendOTP();
  }

  onGoogleLogin() {
    this.isLoading = true;

    this.authService.getGoogleAuthUrl().subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('Google auth URL response:', response);
        
        if (response.EC === 0 && response.auth_url) {
          console.log('Google OAuth URL:', response.auth_url);
          
          if (!response.auth_url.includes('client_id')) {
            console.error('URL không chứa client_id:', response.auth_url);
            alert('Lỗi cấu hình: URL OAuth không hợp lệ. Vui lòng kiểm tra cấu hình backend.');
            return;
          }
          
          window.location.href = response.auth_url;
        } else {
          console.error('Response error:', response);
          alert(response.EM || 'Không thể lấy Google OAuth URL');
        }
      },
      error: (error) => {
        console.error('Error getting Google auth URL:', error);
        this.isLoading = false;
        
        if (error.error) {
          console.error('Error details:', error.error);
          if (error.error.detail) {
            const errorMessages = Array.isArray(error.error.detail) 
              ? error.error.detail.map((err: any) => err.msg || err).join('\n')
              : error.error.detail;
            alert('Lỗi từ server:\n' + errorMessages);
          } else {
            alert('Không thể kết nối với server. Vui lòng kiểm tra:\n1. Backend đang chạy\n2. API endpoint đúng\n3. CORS đã được cấu hình');
          }
        } else {
          alert('Không thể kết nối với server. Vui lòng thử lại.');
        }
      }
    });
  }
}
