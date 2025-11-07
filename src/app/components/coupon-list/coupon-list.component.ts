import { NgFor } from '@angular/common';
import { Component, ViewEncapsulation } from '@angular/core';
import { CarouselModule, OwlOptions } from 'ngx-owl-carousel-o';

@Component({
  selector: 'app-coupon-list',
  imports: [NgFor, CarouselModule],
  templateUrl: './coupon-list.component.html',
  styleUrl: './coupon-list.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class CouponListComponent {

  pathImg = {
    left: 'icon/left.png',
    next: 'icon/next.png'
  }

  coupons: Coupon[] = [
    {
      code: 'HELLOSGCAID',
      description: 'Mã giảm giá lên đến 300.000đ',
      discount: 'Áp dụng cho người dùng mới.',
    },
    {
      code: 'JALANYUK',
      description: 'Giảm 8%',
      discount: 'tối thiểu giao dịch 500.000đ',
    },
    {
      code: 'JALANYUK',
      description: 'Giảm lên đến 8%',
      discount: 'tối thiểu giao dịch 300.000đ',
    },
    {
      code: 'JALANYUK',
      description: 'Giảm lên đến 8%',
      discount: 'tối thiểu giao dịch 300.000đ',
    },
    {
      code: 'JALANYUK',
      description: 'Giảm lên đến 8%',
      discount: 'tối thiểu giao dịch 300.000đ',
    },
    {
      code: 'JALANYUK',
      description: 'Giảm lên đến 8%',
      discount: 'tối thiểu giao dịch 300.000đ',
    },
  ];

  customOptions: OwlOptions = {
    loop: true,
    mouseDrag: false,
    touchDrag: false,
    pullDrag: false,
    dots: false,
    margin: 15,
    navSpeed: 700,
    navText: [
      // `<span class="font-semibold text-blue rounded-md block" > < </span>`,
      // `<span class="font-semibold text-blue rounded-md block" > > </span>`
      `<div>
        <span class="font-semibold text-blue block icon-img" >
          <img src="${this.pathImg.left}" alt="">
        </span>
      </div>
      `,
      `
      <div>
        <span class="font-semibold text-blue block icon-img" >
          <img src="${this.pathImg.next}" alt="">
        </span>
      </div>
      `
    ],
    responsive: {
      0: {
        items: 1
      },
      400: {
        items: 2
      },
      740: {
        items: 3
      },
      940: {
        items: 3
      }
    },
    nav: true
  }

  copyToClipboard(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      alert('Mã giảm giá đã được sao chép: ' + code);
    });
  }
}

interface Coupon {
  code: string;
  description: string;
  discount: string;
}
