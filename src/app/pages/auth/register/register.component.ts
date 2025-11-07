import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  registerMethod: 'email' | 'phone' = 'email';
  isLoading = false;
  otpSent = false;

  registerForm = {
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  };

  phoneRegisterForm = {
    fullName: '',
    phone: '',
    otp: '',
    agreeTerms: false
  };

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  onRegister() {
    if (this.registerMethod === 'email') {
      if (this.registerForm.password !== this.registerForm.confirmPassword) {
        alert('Mật khẩu xác nhận không khớp');
        return;
      }

      if (this.registerForm.fullName && this.registerForm.email && this.registerForm.phone && this.registerForm.password && this.registerForm.agreeTerms) {
        this.isLoading = true;
        this.authService.registerWithEmail(this.registerForm).subscribe({
          next: (response) => {
            console.log('Register success:', response);
            this.isLoading = false;
            // this.router.navigate(['/login']);
          },
          error: (error) => {
            console.error('Register error:', error);
            this.isLoading = false;
          }
        });
      }
    } else {
      if (this.phoneRegisterForm.fullName && this.phoneRegisterForm.phone && this.phoneRegisterForm.otp && this.phoneRegisterForm.agreeTerms) {
        this.isLoading = true;
        this.authService.registerWithPhone(
          this.phoneRegisterForm.phone,
          this.phoneRegisterForm.otp,
          { fullName: this.phoneRegisterForm.fullName }
        ).subscribe({
          next: (response) => {
            console.log('Phone register success:', response);
            this.isLoading = false;
            // this.router.navigate(['/login']);
          },
          error: (error) => {
            console.error('Phone register error:', error);
            this.isLoading = false;
          }
        });
      }
    }
  }

  sendOTP() {
    if (!this.phoneRegisterForm.phone) {
      return;
    }

    this.isLoading = true;
    this.authService.sendOTP(this.phoneRegisterForm.phone).subscribe({
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
    this.phoneRegisterForm.otp = '';
    this.sendOTP();
  }

  onGoogleRegister() {
    this.isLoading = true;
    this.authService.registerWithGoogle().subscribe({
      next: (response) => {
        console.log('Google register success:', response);
        this.isLoading = false;
        // this.router.navigate(['/home']);
      },
      error: (error) => {
        console.error('Google register error:', error);
        this.isLoading = false;
      }
    });
  }
}
