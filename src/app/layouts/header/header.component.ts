import { NgClass } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [NgClass, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  isScrolled = false;
  isHomePage = false;

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

  constructor(private router: Router) {

  }

  ngOnInit(): void {
    this.checkIfHomePage();
    this.router.events.subscribe((ev) => {
      if (ev instanceof NavigationEnd) {
        this.checkIfHomePage();
      }
    })
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
    // Navigate to chat page instead of opening modal
    this.router.navigate(['/chat']);
  }
}

interface Menu {
  label: string;
  url: string;
}
