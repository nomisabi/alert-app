import { useEffect, useState } from 'react';

/**
 * Returns `value`, but only after it stopped changing for `delay` ms.
 * Used for the search box, so we don't send a request on every key press.
 */
export function useDebouncedValue<Value>(value: Value, delay = 300): Value {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
