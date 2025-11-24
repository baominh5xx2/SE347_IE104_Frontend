import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './layouts/header/header.component';
import { FooterComponent } from './layouts/footer/footer.component';
import { AuthStateService } from './services/auth-state.service';
import { filter } from 'rxjs/operators';

import { PrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'traveloka-clone';
  isChatPage = false;

  constructor(
    private primeng: PrimeNG,
    private authStateService: AuthStateService,
    private router: Router
  ) {
    this.primeng.theme.set({
      preset: Aura,
      options: {
        cssLayer: {
          name: 'primeng',
          order: 'tailwind-base, primeng, tailwind-utilities'
        }
      }
    })
  }

  ngOnInit(): void {
    this.authStateService.checkAuthState();
    this.checkChatPage();
    
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkChatPage();
      });
  }

  private checkChatPage(): void {
    this.isChatPage = this.router.url.includes('/chat');
  }
}
