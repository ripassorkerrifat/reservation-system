import {useRef, useCallback, useEffect} from "react";

const DEBOUNCE_DELAY = 500; // 0.5 second

/**
 * Custom hook for debouncing callbacks
 * Prevents rapid successive calls
 */
export function useDebouncedCallback(
     callback: () => void,
     delay: number = DEBOUNCE_DELAY
): () => void {
     const timeoutRef = useRef<NodeJS.Timeout | null>(null);
     const callbackRef = useRef(callback);

     // Update callback ref when it changes
     useEffect(() => {
          callbackRef.current = callback;
     }, [callback]);

     const debouncedCallback = useCallback(() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);

          timeoutRef.current = setTimeout(() => {
               callbackRef.current();
               timeoutRef.current = null;
          }, delay);
     }, [delay]);

     // Cleanup on unmount
     useEffect(() => {
          return () => {
               if (timeoutRef.current) clearTimeout(timeoutRef.current);
          };
     }, []);

     return debouncedCallback;
}
