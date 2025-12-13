import { Injectable } from '@angular/core';
import { ConfigService } from '../config.service';

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
  cuisine?: string;
  suitable_for?: string;
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
  private get apiBaseUrl(): string {
    return `${this.configService.getApiUrl()}/tour-packages`;
  }

  constructor(private configService: ConfigService) { }

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

      const response = await fetch(`${this.apiBaseUrl}/?${params}`);
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

  async createTourPackage(
    packageData: TourPackageCreateRequest,
    images?: File[]
  ): Promise<TourPackageDetailResponse> {
    try {
      console.log('Creating tour package with data:', packageData);
      console.log('Images count:', images?.length || 0);
      
      // If images provided, use multipart/form-data
      if (images && images.length > 0) {
        const formData = new FormData();
        
        // Add all fields
        formData.append('package_name', packageData.package_name);
        formData.append('destination', packageData.destination);
        formData.append('description', packageData.description);
        formData.append('duration_days', packageData.duration_days.toString());
        formData.append('price', packageData.price.toString());
        formData.append('available_slots', packageData.available_slots.toString());
        formData.append('start_date', packageData.start_date);
        formData.append('end_date', packageData.end_date);
        formData.append('is_active', packageData.is_active.toString());
        
        // Optional fields
        if (packageData.cuisine) formData.append('cuisine', packageData.cuisine);
        if (packageData.suitable_for) formData.append('suitable_for', packageData.suitable_for);
        
        // Add images
        images.forEach(file => {
          formData.append('images', file);
        });

        console.log('POST URL:', `${this.apiBaseUrl}/`);
        console.log('Sending FormData with', images.length, 'images');

        const response = await fetch(`${this.apiBaseUrl}/`, {
          method: 'POST',
          body: formData,
        });

        console.log('Create response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Create error response:', errorText);
          try {
            const error = JSON.parse(errorText);
            throw new Error(error.detail || error.EM || `Failed to create: ${response.status}`);
          } catch {
            throw new Error(`Failed to create tour package: ${response.status} - ${errorText}`);
          }
        }
        return await response.json();
      }

      // Fallback to JSON if no images
      const response = await fetch(`${this.apiBaseUrl}/`, {
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
      const url = `${this.apiBaseUrl}/${packageId}`;
      console.log('Updating tour package:', url);
      console.log('Data:', packageData);
      
      // Update tour package data (JSON only)
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(packageData),
      });
      
      console.log('Update response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update error response:', errorText);
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.detail || error.EM || `Failed to update: ${response.status}`);
        } catch {
          throw new Error(`Failed to update tour package: ${response.status} - ${errorText}`);
        }
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating tour package:', error);
      throw error;
    }
  }

  async updateTourImages(
    packageId: string,
    images: File[],
    replaceExisting: boolean = false
  ): Promise<string> {
    try {
      const formData = new FormData();
      images.forEach(file => {
        formData.append('images', file);
      });

      console.log(`Uploading ${images.length} images for tour ${packageId}, replace_existing=${replaceExisting}`);

      const response = await fetch(`${this.apiBaseUrl}/${packageId}/images?replace_existing=${replaceExisting}`, {
        method: 'POST',
        body: formData,
      });

      console.log('Upload images response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload images error:', errorText);
        try {
          const error = JSON.parse(errorText);
          throw new Error(error.detail || `Failed to update images: ${response.status}`);
        } catch {
          throw new Error(`Failed to upload images: ${response.status} - ${errorText}`);
        }
      }

      const imageUrls = await response.json(); // Returns pipe-separated string
      console.log('Uploaded images URLs:', imageUrls);
      return imageUrls;
    } catch (error) {
      console.error('Error updating tour images:', error);
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
