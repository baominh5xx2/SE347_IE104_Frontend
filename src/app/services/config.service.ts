import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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
      console.warn('Failed to load config.json, using environment config');
      this.config = {
        apiUrl: environment.apiUrl
      };
      this.configLoaded = true;
      return this.config;
    }
  }

  getApiUrl(): string {
    if (!this.config) {
      return environment.apiUrl;
    }
    return this.config.apiUrl;
  }

  setConfig(config: AppConfig): void {
    this.config = config;
    this.configLoaded = true;
  }
}

