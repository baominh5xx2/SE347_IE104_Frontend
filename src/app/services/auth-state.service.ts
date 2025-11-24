import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private currentUserSubject = new BehaviorSubject<any>(null);

  public isAuthenticated$: Observable<boolean> = this.isAuthenticatedSubject.asObservable();
  public currentUser$: Observable<any> = this.currentUserSubject.asObservable();

  constructor(private authService: AuthService) {
    this.checkAuthState();
  }

  checkAuthState(): void {
    const token = this.authService.getToken();
    const user = this.authService.getUser();

    if (token && user) {
      this.authService.verifyToken(token).subscribe({
        next: (response) => {
          if (response.EC === 0) {
            this.isAuthenticatedSubject.next(true);
            this.currentUserSubject.next(user);
          } else {
            this.logout();
          }
        },
        error: () => {
          this.logout();
        }
      });
    } else {
      this.logout();
    }
  }

  login(token: string, user: any): void {
    this.isAuthenticatedSubject.next(true);
    this.currentUserSubject.next(user);
  }

  logout(): void {
    this.authService.logout();
    this.isAuthenticatedSubject.next(false);
    this.currentUserSubject.next(null);
  }

  getIsAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getCurrentUser(): any {
    return this.currentUserSubject.value;
  }
}

