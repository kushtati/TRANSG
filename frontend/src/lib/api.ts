// src/lib/api.ts

// URL de l'API Backend (Railway)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isNetworkError = () => this.status === 0;
  isAuthError = () => this.status === 401;
  isValidationError = () => this.status === 400;
  getFieldError = (field: string) => this.errors?.find(e => e.field === field)?.message;
}

class ApiClient {
  private isRefreshing = false;
  private refreshQueue: Array<() => void> = [];

  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    isRetry = false
  ): Promise<{ data?: T; success: boolean }> {
    const url = `${API_BASE}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important pour les cookies cross-origin
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Handle token expiration
        if (response.status === 401 && json.code === 'TOKEN_EXPIRED' && !isRetry) {
          return this.handleTokenRefresh<T>(method, endpoint, data);
        }

        throw new ApiError(
          json.message || 'Une erreur est survenue',
          response.status,
          json.code,
          json.errors
        );
      }

      return { data: json.data || json, success: true };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Erreur de connexion au serveur', 0);
    }
  }

  private async handleTokenRefresh<T>(
    method: string,
    endpoint: string,
    data?: unknown
  ): Promise<{ data?: T; success: boolean }> {
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.refreshQueue.push(() => {
          this.request<T>(method, endpoint, data, true).then(resolve).catch(reject);
        });
      });
    }

    this.isRefreshing = true;

    try {
      const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!refreshResponse.ok) {
        // Session expirée - rediriger vers login
        window.location.href = '/';
        throw new ApiError('Session expirée', 401);
      }

      // Retry original request
      const result = await this.request<T>(method, endpoint, data, true);

      // Process queue
      this.refreshQueue.forEach(callback => callback());
      this.refreshQueue = [];

      return result;
    } finally {
      this.isRefreshing = false;
    }
  }

  get = <T>(endpoint: string) => this.request<T>('GET', endpoint);
  post = <T>(endpoint: string, data?: unknown) => this.request<T>('POST', endpoint, data);
  put = <T>(endpoint: string, data?: unknown) => this.request<T>('PUT', endpoint, data);
  patch = <T>(endpoint: string, data?: unknown) => this.request<T>('PATCH', endpoint, data);
  delete = <T>(endpoint: string) => this.request<T>('DELETE', endpoint);
}

export const api = new ApiClient();
