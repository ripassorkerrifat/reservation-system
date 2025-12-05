"use client";

import {useEffect, useState, useCallback, useRef, useMemo} from "react";
import {
     getRemainingTime,
     formatTime,
     isExpired,
} from "../lib/reservation-timer";
import {Reservation} from "../types";
import {apiClient} from "../lib/api";

interface CountdownTimerProps {
     reservation: Reservation;
     onExpired: () => void;
     pollInterval?: number;
}

const DEFAULT_POLL_INTERVAL = 2000; // 2 seconds
const COUNTDOWN_UPDATE_INTERVAL = 100;
const WARNING_THRESHOLD = 30000; // 30 seconds

export default function CountdownTimer({
     reservation,
     onExpired,
     pollInterval = DEFAULT_POLL_INTERVAL,
}: CountdownTimerProps) {
     const [remainingTime, setRemainingTime] = useState(() =>
          getRemainingTime(reservation.expiresAt)
     );
     const isPollingRef = useRef(false);

     const syncWithBackend = useCallback(async () => {
          if (isPollingRef.current) return;

          isPollingRef.current = true;
          try {
               const updatedReservation = await apiClient.getReservation(
                    reservation.id
               );

               if (updatedReservation.status !== "ACTIVE") {
                    if (updatedReservation.status === "EXPIRED") onExpired();
                    return;
               }

               const backendRemaining = getRemainingTime(
                    updatedReservation.expiresAt
               );
               setRemainingTime(backendRemaining);

               if (backendRemaining === 0) onExpired();
          } catch (error) {
               console.error("Failed to sync with backend:", error);
          } finally {
               isPollingRef.current = false;
          }
     }, [reservation.id, onExpired]);

     // Local countdown timer
     useEffect(() => {
          if (isExpired(reservation.expiresAt)) {
               onExpired();
               return;
          }

          const interval = setInterval(() => {
               const remaining = getRemainingTime(reservation.expiresAt);
               setRemainingTime(remaining);

               if (remaining === 0) {
                    clearInterval(interval);
                    onExpired();
               }
          }, COUNTDOWN_UPDATE_INTERVAL);

          return () => clearInterval(interval);
     }, [reservation.expiresAt, onExpired]);

     // Backend sync polling
     useEffect(() => {
          const pollIntervalId = setInterval(syncWithBackend, pollInterval);
          syncWithBackend(); // Initial sync

          return () => clearInterval(pollIntervalId);
     }, [syncWithBackend, pollInterval]);

     const {isExpiredNow, styles} = useMemo(() => {
          const expired = remainingTime === 0;
          const warning = remainingTime < WARNING_THRESHOLD && !expired;

          return {
               isExpiredNow: expired,
               styles: {
                    container: expired
                         ? "bg-red-50 border-2 border-red-200 text-red-700"
                         : warning
                         ? "bg-amber-50 border-2 border-amber-200 text-amber-700"
                         : "bg-blue-50 border-2 border-blue-200 text-blue-700",
                    icon: expired
                         ? "text-red-600"
                         : warning
                         ? "text-amber-600"
                         : "text-blue-600",
                    time: expired
                         ? "text-red-800"
                         : warning
                         ? "text-amber-800"
                         : "text-blue-800",
               },
          };
     }, [remainingTime]);

     return (
          <div
               className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-medium ${styles.container}`}>
               <svg
                    className={`w-5 h-5 ${styles.icon}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                         strokeLinecap="round"
                         strokeLinejoin="round"
                         strokeWidth={2}
                         d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
               </svg>
               <span className="text-sm font-semibold">
                    {isExpiredNow ? "Reservation Expired" : "Time Remaining"}
               </span>
               <span className={`font-mono text-lg font-bold ${styles.time}`}>
                    {formatTime(remainingTime)}
               </span>
          </div>
     );
}
