
import { useState, useEffect, useCallback } from 'react';

/**
 * A custom React hook that syncs a state variable with the browser's localStorage.
 * This allows data to persist across page reloads.
 *
 * It behaves similarly to `React.useState`, but the value is read from and saved to
 * localStorage automatically.
 *
 * @template T The type of the value to be stored.
 * @param {string} key The key to use for storing the value in localStorage.
 * @param {T} initialValue The initial value to use if no value is found in localStorage.
 * @returns A stateful value, and a function to update it. The signature is identical to `React.useState`.
 */
export function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // 1. Initialize the state.
  // We use the lazy initializer form of useState (`useState(() => ...)`).
  // This function only runs on the initial render, preventing a potentially
  // expensive localStorage `getItem` call on every re-render.
  const [storedValue, setStoredValue] = useState<T>(() => {
    // localStorage is a browser-only API. If this code runs on a server (SSR),
    // we just return the initial value.
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      // Try to get the value from localStorage.
      const item = window.localStorage.getItem(key);
      // If an item is found, parse it from JSON. Otherwise, use the initial value.
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If parsing fails (e.g., corrupted data), log the error and use the initial value.
      console.error(error);
      return initialValue;
    }
  });

  // 2. Create a memoized `setValue` function.
  // `useCallback` ensures that this function reference doesn't change on every render,
  // which is important for performance if it's passed as a prop or used in a `useEffect` dependency array.
  const setValue = useCallback<React.Dispatch<React.SetStateAction<T>>>((value) => {
    try {
      // The `setValue` function can receive a new value directly or a function to compute the new value.
      // We resolve this to get the final value to store.
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      // Update the React state.
      setStoredValue(valueToStore);
      
      // Persist the new value to localStorage.
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]); // `storedValue` is included as a dependency for the functional update form.
  
  // NOTE: A more advanced version might remove `storedValue` from the `useCallback`
  // dependency array by using the functional update form of `setStoredValue` inside `setValue`.
  // This gives `setValue` a stable identity. Example:
  /*
  const setValue = useCallback((value) => {
    setStoredValue(currentValue => {
      const valueToStore = value instanceof Function ? value(currentValue) : value;
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      return valueToStore;
    });
  }, [key]);
  */
  // For this app's scale, the current implementation is perfectly fine.

  // 3. Listen for changes in other tabs.
  // This `useEffect` sets up a 'storage' event listener. If the same localStorage key
  // is changed in another browser tab, this hook will update its state to match,
  // keeping the application state synchronized across tabs.
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key) {
            try {
                // When a change occurs, update the state with the new value from the event.
                setStoredValue(e.newValue ? JSON.parse(e.newValue) : initialValue);
            } catch (error) {
                console.error(error);
                setStoredValue(initialValue);
            }
        }
    };
    window.addEventListener('storage', handleStorageChange);
    // Cleanup function: remove the event listener when the component unmounts.
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  // The dependencies are `key` and `initialValue` to ensure the listener is set up correctly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, initialValue]);

  // Return the state and setter function, just like `useState`.
  return [storedValue, setValue];
}


/**
 * A custom hook that provides a running timer as a formatted string (e.g., "05:32").
 * It takes a start timestamp and updates every second.
 *
 * @param {string | null} timestamp The ISO string of the start time. If null, the timer resets to "00:00".
 * @returns {string} The formatted timer string.
 */
export const useSessionTimer = (timestamp: string | null) => {
    // The state variable that holds the formatted timer string.
    const [timer, setTimer] = useState("00:00");

    useEffect(() => {
        // If there's no start timestamp, reset the timer and do nothing further.
        if (!timestamp) {
            setTimer("00:00");
            return;
        }

        // Set up an interval that runs every 1000ms (1 second).
        const interval = setInterval(() => {
            // Calculate the total elapsed milliseconds.
            const elapsed = Date.now() - new Date(timestamp).getTime();
            
            // Convert milliseconds to hours, minutes, and seconds.
            const seconds = Math.floor((elapsed / 1000) % 60);
            const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
            const hours = Math.floor(elapsed / (1000 * 60 * 60));

            // Format the output string. Pad with leading zeros.
            // Only show hours if the timer has been running for at least an hour.
            if (hours > 0) {
                setTimer(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            } else {
                setTimer(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            }
        }, 1000);

        // Cleanup function: this is crucial to prevent memory leaks.
        // It runs when the component unmounts or when the `timestamp` dependency changes.
        // It stops the interval, so we don't have timers running in the background.
        return () => clearInterval(interval);
    }, [timestamp]); // The effect re-runs whenever the `timestamp` prop changes.

    return timer;
};
