import { Component } from '@angular/core';
import { PaymentMethodComponent } from '../../components/payment-method/payment-method.component';
import { HotelDetailsComponent } from '../../components/hotel-details/hotel-details.component';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgFor } from '@angular/common';

@Component({
  selector: 'app-payment',
  imports: [
    PaymentMethodComponent,
    HotelDetailsComponent,
    NgFor,
    FormsModule,
    CommonModule
  ],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss'
})
export class PaymentComponent {

  paymentOptions: PaymentOption[] = [
    { name: 'Tài khoản ảo', description: 'BCA, Mandiri, BRIVA, BNI', isNew: true },
    { name: 'Chuyển khoản ngân hàng', description: '', isNew: false },
    { name: 'Thẻ tín dụng/Ghi nợ', description: '', isNew: false },
    { name: 'Cửa hàng tiện lợi', description: '', isNew: false },
  ];

  totalPrice: number = 660000;
  couponCode: string = '';

  applyCoupon() {
    // Logic to apply coupon
    console.log('Applying coupon:', this.couponCode);
  }

  proceedToPayment() {
    // Logic to proceed to payment
    console.log('Proceeding to payment...');
  }

}

interface PaymentOption {
  name: string;
  description: string;
  isNew: boolean;
}
