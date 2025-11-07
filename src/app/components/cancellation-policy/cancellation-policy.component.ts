import { NgFor } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-cancellation-policy',
  imports: [NgFor],
  templateUrl: './cancellation-policy.component.html',
  styleUrl: './cancellation-policy.component.scss'
})
export class CancellationPolicyComponent {

  description: string = 'Bạn đã chọn được phòng với giá tốt nhất từ các lựa chọn này!';
  policies: string[] = [
    'Đặt phòng này không thể hoàn tiền.',
    'Không thể đổi lịch'
  ];
}
