import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-hero',
  imports: [],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent {

  constructor(private router: Router) { }

  menuItems: Menu[] = [
    {
      label: 'Khách sạn', url: '', path: 'icon/hotel.png',
      isActive: true
    },
    {
      label: 'Vé máy bay', url: '', path: 'icon/air-plane.png',
      isActive: false
    },
    {
      label: 'Vé tàu hỏa', url: '', path: 'icon/train.png',
      isActive: false
    },
    {
      label: 'Vé xe khách & Du lịch', url: '', path: 'icon/train.png',
      isActive: false
    },
    {
      label: 'Đưa đón sân bay', url: '', path: 'icon/car.png',
      isActive: false
    },
    {
      label: 'Thuê xe', url: '', path: 'icon/car.png',
      isActive: false
    },
    {
      label: 'Giải trí và hoạt động', url: '', path: 'icon/car.png',
      isActive: false
    },
    {
      label: 'Khác', url: '', path: 'icon/car.png',
      isActive: false
    },
  ]

  onSearch() {
    this.router.navigate(['/hotel'])
  }
}

interface Menu {
  label: string;
  url: string;
  path: string;
  isActive: boolean;
}
