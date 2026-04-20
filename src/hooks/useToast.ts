'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error';

export interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
    title?: string;
}

const AUTO_DISMISS_MS = 4500;

export function useToast() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const timeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    const dismissToast = useCallback((id: number) => {
        const timeoutId = timeoutsRef.current.get(id);
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutsRef.current.delete(id);
        }

        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType, title?: string) => {
        const id = Date.now() + Math.floor(Math.random() * 1000);

        setToasts((prev) => [...prev, { id, message, type, title }]);

        const timeoutId = setTimeout(() => {
            dismissToast(id);
        }, AUTO_DISMISS_MS);

        timeoutsRef.current.set(id, timeoutId);
    }, [dismissToast]);

    useEffect(() => {
        const timeouts = timeoutsRef.current;

        return () => {
            timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
            timeouts.clear();
        };
    }, []);

    return {
        toasts,
        showToast,
        dismissToast,
    };
}
