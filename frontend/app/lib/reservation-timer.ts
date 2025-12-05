/**
 * Utility functions for managing reservation timers
 * Handles persistence and calculation of remaining time
 */

export interface TimerState {
     reservationId: string;
     expiresAt: string;
     startedAt: number; // timestamp when timer was started
}

const STORAGE_KEY = "active_reservation_timer";

/**
 * Save timer state to localStorage
 */
export function saveTimerState(state: TimerState | null): void {
     if (typeof window === "undefined") return;

     if (state) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
     } else {
          localStorage.removeItem(STORAGE_KEY);
     }
}

/**
 * Load timer state from localStorage
 */
export function loadTimerState(): TimerState | null {
     if (typeof window === "undefined") return null;

     const stored = localStorage.getItem(STORAGE_KEY);
     if (!stored) return null;

     try {
          return JSON.parse(stored);
     } catch {
          return null;
     }
}

/**
 * Calculate remaining time in milliseconds
 */
export function getRemainingTime(expiresAt: string): number {
     const expirationTime = new Date(expiresAt).getTime();
     const now = Date.now();
     return Math.max(0, expirationTime - now);
}

/**
 * Format milliseconds to MM:SS
 */
export function formatTime(ms: number): string {
     const totalSeconds = Math.floor(ms / 1000);
     const minutes = Math.floor(totalSeconds / 60);
     const seconds = totalSeconds % 60;
     return `${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`;
}

/**
 * Check if reservation has expired
 */
export function isExpired(expiresAt: string): boolean {
     return getRemainingTime(expiresAt) === 0;
}
