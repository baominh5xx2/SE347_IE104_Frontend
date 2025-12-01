import { Injectable } from '@angular/core';

export interface TourPackage {
  package_id?: string;
  package_name: string;
  destination: string;
  description: string;
  duration_days: number;
  price: number;
  available_slots: number;
  start_date: string;
  end_date: string;
  image_urls: string;
  cuisine: string;
  suitable_for: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TourPackageListResponse {
  EC: number;
  EM: string;
  total: number;
  packages: TourPackage[];
}

export interface TourPackageDetailResponse {
  EC: number;
  EM: string;
  package: TourPackage;
}

export interface TourPackageCreateRequest {
  package_name: string;
  destination: string;
  description: string;
  duration_days: number;
  price: number;
  available_slots: number;
  start_date: string;
  end_date: string;
  image_urls: string;
  cuisine: string;
  suitable_for: string;
  is_active: boolean;
}

export interface TourPackageUpdateRequest {
  package_name?: string;
  destination?: string;
  description?: string;
  duration_days?: number;
  price?: number;
  available_slots?: number;
  start_date?: string;
  end_date?: string;
  image_urls?: string;
  cuisine?: string;
  suitable_for?: string;
  is_active?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminTourService {
  private apiBaseUrl = 'http://localhost:8000/api/v1/tour-packages/';

  constructor() { }

  async getTourPackages(
    is_active?: boolean,
    destination?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<TourPackageListResponse> {
    try {
      const params = new URLSearchParams();
      if (is_active !== undefined) params.append('is_active', is_active.toString());
      if (destination) params.append('destination', destination);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`${this.apiBaseUrl}?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tour packages: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching tour packages:', error);
      throw error;
    }
  }

  async getTourPackageById(packageId: string): Promise<TourPackageDetailResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${packageId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tour package: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching tour package:', error);
      throw error;
    }
  }

  async createTourPackage(packageData: TourPackageCreateRequest): Promise<TourPackageDetailResponse> {
    try {
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(packageData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Failed to create tour package: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating tour package:', error);
      throw error;
    }
  }

  async updateTourPackage(
    packageId: string,
    packageData: TourPackageUpdateRequest
  ): Promise<TourPackageDetailResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${packageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(packageData),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `Failed to update tour package: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating tour package:', error);
      throw error;
    }
  }

  async deleteTourPackage(packageId: string): Promise<{ EC: number; EM: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${packageId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete tour package: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting tour package:', error);
      throw error;
    }
  }
}
