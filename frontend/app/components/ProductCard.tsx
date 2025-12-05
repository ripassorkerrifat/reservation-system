"use client";

import {useState, useEffect, useRef, useCallback} from "react";
import Image from "next/image";
import {Product, Reservation, ReservationStatus} from "../types";
import {apiClient} from "../lib/api";
import {saveTimerState, loadTimerState} from "../lib/reservation-timer";
import CountdownTimer from "./CountdownTimer";
import LoadingSpinner from "./LoadingSpinner";
import {useDebouncedCallback} from "../hooks/useDebouncedCallback";

interface ProductCardProps {
     product: Product;
     onReservationChange?: () => void;
}

const DEBOUNCE_DELAY = 1000;

export default function ProductCard({
     product,
     onReservationChange,
}: ProductCardProps) {
     const [reservation, setReservation] = useState<Reservation | null>(null);
     const [isReserving, setIsReserving] = useState(false);
     const [isCompleting, setIsCompleting] = useState(false);
     const [error, setError] = useState<string | null>(null);
     const hasLoadedRef = useRef<string | null>(null);
     const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

     // Debounced refresh callback
     const debouncedRefresh = useDebouncedCallback(() => {
          onReservationChange?.();
     }, DEBOUNCE_DELAY);

     // Load reservation from localStorage on mount and when product changes
     useEffect(() => {
          if (hasLoadedRef.current === product.id) return;

          let isMounted = true;

          const loadReservation = async () => {
               const saved = loadTimerState();

               if (saved?.reservationId) {
                    // Quick expiration check
                    const expirationTime = new Date(saved.expiresAt).getTime();
                    if (Date.now() >= expirationTime) {
                         if (isMounted) {
                              saveTimerState(null);
                              setReservation(null);
                         }
                         return;
                    }

                    try {
                         const res = await apiClient.getReservation(
                              saved.reservationId
                         );

                         if (!isMounted) return;

                         if (
                              res.status === ReservationStatus.ACTIVE &&
                              res.productId === product.id
                         ) {
                              setReservation(res);
                              saveTimerState({
                                   reservationId: res.id,
                                   expiresAt: res.expiresAt,
                                   startedAt: Date.now(),
                              });
                         } else {
                              if (res.productId === product.id) {
                                   saveTimerState(null);
                              }
                              setReservation(null);
                         }
                    } catch (error) {
                         if (isMounted) {
                              console.error(
                                   "Failed to load reservation:",
                                   error
                              );
                              setReservation(null);
                         }
                    }
               } else if (isMounted) setReservation(null);

               if (isMounted) hasLoadedRef.current = product.id;
          };

          loadReservation();

          return () => {
               isMounted = false;
          };
     }, [product.id]);

     const handleReserve = async () => {
          if (reservation?.status === ReservationStatus.ACTIVE) {
               setError(
                    "You already have an active reservation for this product"
               );
               return;
          }

          if (isReserving) return;

          setIsReserving(true);
          setError(null);

          try {
               const newReservation = await apiClient.createReservation({
                    productId: product.id,
                    quantity: 1,
               });

               setReservation(newReservation);
               saveTimerState({
                    reservationId: newReservation.id,
                    expiresAt: newReservation.expiresAt,
                    startedAt: Date.now(),
               });

               debouncedRefresh();
          } catch (err) {
               setError(
                    err instanceof Error
                         ? err.message
                         : "Failed to create reservation"
               );
          } finally {
               setIsReserving(false);
          }
     };

     const handleComplete = async () => {
          if (!reservation) return;

          setIsCompleting(true);
          setError(null);

          try {
               const completed = await apiClient.completeReservation(
                    reservation.id
               );
               setReservation(completed);
               saveTimerState(null);
               debouncedRefresh();
          } catch (err) {
               setError(
                    err instanceof Error
                         ? err.message
                         : "Failed to complete reservation"
               );
          } finally {
               setIsCompleting(false);
          }
     };

     const handleExpired = useCallback(() => {
          setReservation(null);
          saveTimerState(null);
          debouncedRefresh();
     }, [debouncedRefresh]);

     // Cleanup timeout on unmount
     useEffect(() => {
          const timeout = refreshTimeoutRef.current;
          return () => {
               if (timeout) clearTimeout(timeout);
          };
     }, []);

     const hasActiveReservation =
          reservation?.status === ReservationStatus.ACTIVE;
     const isOutOfStock = product.availableStock === 0 && !hasActiveReservation;

     const getStockColor = () => {
          if (product.availableStock > 10) return "text-green-600";
          if (product.availableStock > 0) return "text-yellow-600";
          return "text-red-600";
     };

     return (
          <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col">
               {product.thumbnail && (
                    <div className="relative w-full h-64 bg-gray-100 overflow-hidden">
                         <Image
                              src={product.thumbnail}
                              alt={product.name}
                              fill
                              className="object-cover transition-transform duration-300 hover:scale-105"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                         />
                    </div>
               )}

               <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                         {product.name}
                    </h3>

                    <div className="mb-4 space-y-2">
                         <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-bold text-emerald-600">
                                   ${product.price.toFixed(2)}
                              </span>
                         </div>
                         <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-500">Stock:</span>
                              <span
                                   className={`font-semibold ${getStockColor()}`}>
                                   {product.availableStock} available
                              </span>
                         </div>
                    </div>

                    {error && (
                         <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-sm text-red-800 font-medium">
                                   {error}
                              </p>
                         </div>
                    )}

                    {hasActiveReservation ? (
                         <div className="mt-auto space-y-3">
                              <CountdownTimer
                                   reservation={reservation}
                                   onExpired={handleExpired}
                              />
                              <button
                                   onClick={handleComplete}
                                   disabled={isCompleting}
                                   className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold px-6 py-3 rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                                   {isCompleting ? (
                                        <span className="flex items-center justify-center gap-2">
                                             <LoadingSpinner size="sm" />
                                             Completing...
                                        </span>
                                   ) : (
                                        "Complete Purchase"
                                   )}
                              </button>
                         </div>
                    ) : (
                         <button
                              onClick={handleReserve}
                              disabled={isReserving || isOutOfStock}
                              className={`w-full font-semibold px-6 py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none disabled:shadow-none ${
                                   isOutOfStock
                                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                        : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
                              } disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed`}>
                              {isReserving ? (
                                   <span className="flex items-center justify-center gap-2">
                                        <LoadingSpinner size="sm" />
                                        Reserving...
                                   </span>
                              ) : isOutOfStock ? (
                                   "Out of Stock"
                              ) : (
                                   "Reserve Now (2 min)"
                              )}
                         </button>
                    )}
               </div>
          </div>
     );
}
