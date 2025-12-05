const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

import type {Product, Reservation, CreateReservationDto} from "../types";

export class ApiClient {
     private baseUrl: string;

     constructor(baseUrl: string = API_BASE_URL) {
          this.baseUrl = baseUrl;
     }

     private async request<T>(
          endpoint: string,
          options: RequestInit = {}
     ): Promise<T> {
          const url = `${this.baseUrl}${endpoint}`;
          const response = await fetch(url, {
               ...options,
               headers: {
                    "Content-Type": "application/json",
                    ...options.headers,
               },
          });

          if (!response.ok) {
               const error = await response
                    .json()
                    .catch(() => ({message: response.statusText}));
               throw new Error(
                    error.message || `HTTP error! status: ${response.status}`
               );
          }

          return response.json();
     }

     async getProducts(): Promise<Product[]> {
          return this.request<Product[]>("/products");
     }

     async createReservation(data: CreateReservationDto): Promise<Reservation> {
          return this.request<Reservation>("/reservations", {
               method: "POST",
               body: JSON.stringify(data),
          });
     }

     async getReservation(id: string): Promise<Reservation> {
          return this.request<Reservation>(`/reservations/${id}`);
     }

     async completeReservation(id: string): Promise<Reservation> {
          return this.request<Reservation>(`/reservations/${id}/complete`, {
               method: "POST",
          });
     }
}

export const apiClient = new ApiClient();
