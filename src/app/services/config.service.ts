import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AppConfig {
  apiUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private config: AppConfig | null = null;
  private configLoaded = false;

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<AppConfig> {
    if (this.configLoaded && this.config) {
      return this.config;
    }

    try {
      const config = await firstValueFrom(
        this.http.get<AppConfig>('/assets/config.json')
      );
      this.config = config;
      this.configLoaded = true;
      return config;
    } catch (error) {
      console.warn('Failed to load config.json, using default config');
      this.config = {
        apiUrl: 'http://localhost:8000/api/v1'
      };
      this.configLoaded = true;
      return this.config;
    }
  }

  getApiUrl(): string {
    if (!this.config) {
      return 'http://localhost:8000/api/v1';
    }
    return this.config.apiUrl;
  }

  setConfig(config: AppConfig): void {
    this.config = config;
    this.configLoaded = true;
  }
}

