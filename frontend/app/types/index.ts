export enum ReservationStatus {
     ACTIVE = "ACTIVE",
     COMPLETED = "COMPLETED",
     EXPIRED = "EXPIRED",
}

export interface Product {
     id: string;
     name: string;
     price: number;
     availableStock: number;
     thumbnail?: string;
     createdAt: string;
     updatedAt: string;
}

export interface Reservation {
     id: string;
     productId: string;
     product: Product;
     quantity: number;
     status: ReservationStatus;
     createdAt: string;
     expiresAt: string;
     updatedAt: string;
}

export interface CreateReservationDto {
     productId: string;
     quantity: number;
}
