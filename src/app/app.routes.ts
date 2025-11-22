import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { HotelComponent } from './pages/hotel/hotel.component';
import { ProducDetailsComponent } from './pages/produc-details/produc-details.component';
import { BookingPagesComponent } from './pages/booking-pages/booking-pages.component';
import { PaymentComponent } from './pages/payment/payment.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { RegisterComponent } from './pages/auth/register/register.component';
import { ToursComponent } from './pages/tours/tours.component';
import { AiChatbotComponent } from './components/ai-chatbot/ai-chatbot.component';

export const routes: Routes = [
  {
    path: '', redirectTo: '/home', pathMatch: 'full'
  },

  {
    path: 'home', component: HomeComponent
  },
  {
    path: 'hotel', component: HotelComponent
  },
  {
    path: 'hotel/detail', component: ProducDetailsComponent
  },
  {
    path: 'tours', component: ToursComponent
  },
  {
    path: 'tour-details/:id', component: ProducDetailsComponent
  },
  {
    path: 'booking/:id', component: BookingPagesComponent
  },
  {
    path: 'payment', component: PaymentComponent
  },
  {
    path: 'login', component: LoginComponent
  },
  {
    path: 'register', component: RegisterComponent
  },
  {
    path: 'chat', component: AiChatbotComponent
  },
];
