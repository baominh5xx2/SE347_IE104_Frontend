import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'tours',
        loadComponent: () => import('./tours/tour-list.component').then(m => m.TourListComponent)
      },
      {
        path: 'bookings',
        loadComponent: () => import('./bookings/booking-list.component').then(m => m.BookingListComponent)
      },
      {
        path: 'customers',
        loadComponent: () => import('./customers/customer-list.component').then(m => m.CustomerListComponent)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  }
];
