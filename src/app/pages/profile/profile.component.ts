import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  currentUser: any = null;
  isLoading = false;

  constructor(
    private authStateService: AuthStateService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authStateService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    if (!this.authStateService.getIsAuthenticated()) {
      this.router.navigate(['/login']);
    }
  }

  onLogout(): void {
    this.isLoading = true;
    this.authStateService.logout();
    this.isLoading = false;
    this.router.navigate(['/home']);
  }
}
