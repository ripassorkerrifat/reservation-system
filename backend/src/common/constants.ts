/**
 * Shared constants across the application
 */

export enum ReservationStatus {
     ACTIVE = "ACTIVE",
     COMPLETED = "COMPLETED",
     EXPIRED = "EXPIRED",
}

export const RESERVATION_DURATION_MS = 2 * 60 * 1000; // 2 minutes
export const PERIODIC_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
export const RECOVERY_DELAY_MS = 1000; // 1 second
export const JOB_RETRY_ATTEMPTS = 3;
export const JOB_RETRY_DELAY_MS = 5000;
