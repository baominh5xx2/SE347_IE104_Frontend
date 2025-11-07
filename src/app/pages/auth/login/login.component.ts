import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

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
    private authService: AuthService
  ) {}

  onLogin() {
    this.isLoading = true;

    if (this.loginMethod === 'email') {
      if (this.loginForm.email && this.loginForm.password) {
        this.authService.loginWithEmail(this.loginForm.email, this.loginForm.password).subscribe({
          next: (response) => {
            console.log('Login success:', response);
            this.isLoading = false;
            // this.router.navigate(['/home']);
          },
          error: (error) => {
            console.error('Login error:', error);
            this.isLoading = false;
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
    this.authService.loginWithGoogle().subscribe({
      next: (response) => {
        console.log('Google login success:', response);
        this.isLoading = false;
        // this.router.navigate(['/home']);
      },
      error: (error) => {
        console.error('Google login error:', error);
        this.isLoading = false;
      }
    });
  }
}
