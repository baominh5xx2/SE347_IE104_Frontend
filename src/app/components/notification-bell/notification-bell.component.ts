import { Component, OnInit, OnDestroy, Input, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { NotificationService, Notification } from '../../services/notification.service';

@Component({
    selector: 'app-notification-bell',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './notification-bell.component.html',
    styleUrls: ['./notification-bell.component.scss']
})
export class NotificationBellComponent implements OnInit, OnDestroy {
    @Input() isWhiteMode = false; // For transparent header

    notifications: Notification[] = [];
    unreadCount = 0;
    isDropdownOpen = false;
    isLoading = false;

    private subscriptions: Subscription[] = [];
    private pollInterval = 30000; // Poll every 30 seconds

    constructor(
        private notificationService: NotificationService,
        private router: Router,
        private elementRef: ElementRef
    ) { }

    ngOnInit(): void {
        this.loadUnreadCount();
        this.loadNotifications();

        // Set up polling for new notifications
        const pollSub = interval(this.pollInterval).subscribe(() => {
            this.loadUnreadCount();
        });
        this.subscriptions.push(pollSub);
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event): void {
        if (!this.elementRef.nativeElement.contains(event.target)) {
            this.isDropdownOpen = false;
        }
    }

    toggleDropdown(): void {
        this.isDropdownOpen = !this.isDropdownOpen;
        if (this.isDropdownOpen) {
            this.loadNotifications();
        }
    }

    loadUnreadCount(): void {
        this.notificationService.getUnreadCount().subscribe({
            next: (response) => {
                if (response.EC === 0) {
                    this.unreadCount = response.count;
                }
            },
            error: (err) => console.error('Error loading unread count:', err)
        });
    }

    loadNotifications(): void {
        this.isLoading = true;
        this.notificationService.getNotifications(false, 20).subscribe({
            next: (response) => {
                if (response.EC === 0 && response.data) {
                    this.notifications = response.data;
                }
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading notifications:', err);
                this.isLoading = false;
            }
        });
    }

    markAsRead(notification: Notification, event: Event): void {
        event.stopPropagation();

        if (!notification.is_read) {
            this.notificationService.markAsRead(notification.notification_id).subscribe({
                next: (response) => {
                    if (response.EC === 0) {
                        notification.is_read = true;
                        this.unreadCount = Math.max(0, this.unreadCount - 1);
                    }
                },
                error: (err) => console.error('Error marking as read:', err)
            });
        }

        // Navigate if metadata contains link
        if (notification.metadata?.link) {
            this.router.navigate([notification.metadata.link]);
            this.isDropdownOpen = false;
        }
    }

    markAllAsRead(): void {
        this.notificationService.markAllAsRead().subscribe({
            next: (response) => {
                if (response.EC === 0) {
                    this.notifications.forEach(n => n.is_read = true);
                    this.unreadCount = 0;
                }
            },
            error: (err) => console.error('Error marking all as read:', err)
        });
    }

    formatTimeAgo(dateString: string): string {
        return this.notificationService.formatTimeAgo(dateString);
    }

    getIcon(type: string): string {
        return this.notificationService.getNotificationIcon(type);
    }

    getIconColor(type: string): string {
        return this.notificationService.getNotificationIconColor(type);
    }

    trackByNotificationId(index: number, notification: Notification): string {
        return notification.notification_id;
    }
}
