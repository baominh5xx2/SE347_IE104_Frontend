import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getToken();
  
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  try {
    const response = await firstValueFrom(authService.verifyToken(token));
    if (response && response.EC === 0) {
      return true;
    } else {
      authService.logout();
      router.navigate(['/login']);
      return false;
    }
  } catch {
    authService.logout();
    router.navigate(['/login']);
    return false;
  }
};

