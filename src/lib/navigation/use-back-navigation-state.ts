"use client";

import { useCallback, useState } from "react";

const memory = new Map<string, unknown>();

export function clearBackNavigationState(): void {
  memory.clear();
}

export function useBackNavigationState<T>(
  key: string,
  initialValue: T
): readonly [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    return memory.has(key) ? (memory.get(key) as T) : initialValue;
  });

  const update = useCallback(
    (next: T) => {
      memory.set(key, next);
      setValue(next);
    },
    [key]
  );

  return [value, update] as const;
}
