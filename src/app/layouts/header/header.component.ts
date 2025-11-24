import { NgClass, NgIf } from '@angular/common';
import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';
import { ChatbotService } from '../../services/chatbot.service';
import { AiChatbotComponent } from '../../components/ai-chatbot/ai-chatbot.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  imports: [NgClass, NgIf, RouterLink, AiChatbotComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  isScrolled = false;
  isHomePage = false;
  showChatbot = false;
  isAuthenticated = false;
  currentUser: any = null;
  private chatbotSubscription?: Subscription;

  classHeader: string = '';
  textClass: string = ''


  topMenu: Menu[] = [
    { label: 'Trang chủ', url: '/home' },
    { label: 'Khuyến mãi', url: '' },
    { label: 'Trợ giúp', url: '' },
    { label: 'Trở thành đối tác', url: '' },
    { label: 'Cho doanh nghiệp', url: '' },
    { label: 'Đơn hàng', url: '' },
  ]

  bottomMenu: Menu[] = [
    { label: 'Tour du lịch', url: '/tours' },
    { label: 'Khách sạn', url: '' },
    { label: 'Vé máy bay', url: '' },
    { label: 'Vé tàu hỏa', url: '' },
    { label: 'Đưa đón sân bay', url: '' },
    { label: 'Thuê xe', url: '' },
    { label: 'Giải trí và hoạt động', url: '' },
    { label: 'Sản phẩm khác', url: '' },
  ]

  constructor(
    private router: Router,
    private authStateService: AuthStateService,
    private chatbotService: ChatbotService
  ) {}

  ngOnInit(): void {
    this.checkIfHomePage();
    this.checkAuthState();
    
    this.router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd) {
        this.checkIfHomePage();
      }
    });

    this.authStateService.isAuthenticated$.subscribe(isAuth => {
      this.isAuthenticated = isAuth;
    });

    this.authStateService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.chatbotSubscription = this.chatbotService.openChatbot$.subscribe(() => {
      this.openChatbot();
    });
  }

  ngOnDestroy() {
    if (this.chatbotSubscription) {
      this.chatbotSubscription.unsubscribe();
    }
  }

  checkAuthState(): void {
    this.isAuthenticated = this.authStateService.getIsAuthenticated();
    this.currentUser = this.authStateService.getCurrentUser();
  }

  onLogout(): void {
    this.authStateService.logout();
    this.router.navigate(['/home']);
  }

  checkIfHomePage(): void {
    this.isHomePage = this.router.url == '/' || this.router.url == '/home';
    if (!this.isHomePage) {
      this.classHeader = `shadow-md bg-white relative`
      this.textClass = `text-gray-700`
    } else {
      this.classHeader = '';
      this.textClass = '';
      this.isScrolled = false;
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {

    if (this.isHomePage) {
      const offset = window.pageYOffset || document.documentElement.scrollTop;
      this.isScrolled = offset > 50;
      // console.log("Home", this.isHomePage)
      // console.log(this.isScrolled)
    }

  }

  openChatbot(): void {
    if (!this.isAuthenticated) {
      this.router.navigate(['/login']);
      return;
    }
    this.showChatbot = true;
  }

  closeChatbot(): void {
    this.showChatbot = false;
  }
}

interface Menu {
  label: string;
  url: string;
}
