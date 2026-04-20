'use client';

import { FiAlertCircle, FiCheckCircle, FiX } from 'react-icons/fi';
import { hexToRgba } from '@/lib/theme';
import type { ToastItem } from '@/hooks/useToast';

interface ToastViewportProps {
    toasts: ToastItem[];
    onDismiss: (id: number) => void;
    themeColor?: string;
}

export default function ToastViewport({
    toasts,
    onDismiss,
    themeColor = '#2563eb',
}: ToastViewportProps) {
    return (
        <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
            {toasts.map((toast) => {
                const isSuccess = toast.type === 'success';
                const accentColor = isSuccess ? themeColor : '#ef4444';
                const Icon = isSuccess ? FiCheckCircle : FiAlertCircle;

                return (
                    <div
                        key={toast.id}
                        className="pointer-events-auto overflow-hidden rounded-2xl border bg-white/95 shadow-xl backdrop-blur-sm transition-all duration-300"
                        style={{
                            borderColor: hexToRgba(accentColor, 0.18),
                            boxShadow: `0 18px 40px ${hexToRgba(accentColor, 0.14)}`,
                        }}
                    >
                        <div
                            className="h-1 w-full"
                            style={{ backgroundColor: accentColor }}
                        />
                        <div className="flex items-start gap-3 p-4">
                            <div
                                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                                style={{
                                    color: accentColor,
                                    backgroundColor: hexToRgba(accentColor, 0.12),
                                }}
                            >
                                <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900">
                                    {toast.title || (isSuccess ? 'Success' : 'Action needed')}
                                </p>
                                <p className="mt-1 text-sm leading-5 text-gray-600">
                                    {toast.message}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => onDismiss(toast.id)}
                                className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                                aria-label="Dismiss notification"
                            >
                                <FiX className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
