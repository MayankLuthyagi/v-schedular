'use client';

import type { ButtonHTMLAttributes } from 'react';
import { FiEdit2 } from 'react-icons/fi';
import { hexToRgba } from '@/lib/theme';

interface EditIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
    themeColor?: string;
    label?: string;
}

export default function EditIconButton({
    themeColor = '#2563eb',
    label = 'Edit',
    className = '',
    ...props
}: EditIconButtonProps) {
    return (
        <div className="group relative inline-flex">
            <button
                type="button"
                aria-label={label}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`.trim()}
                style={{
                    color: themeColor,
                    borderColor: hexToRgba(themeColor, 0.2),
                    backgroundColor: hexToRgba(themeColor, 0.08),
                    boxShadow: `0 8px 20px ${hexToRgba(themeColor, 0.12)}`,
                }}
                {...props}
            >
                <FiEdit2 className="h-4 w-4" />
            </button>
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 translate-y-1 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {label}
            </span>
        </div>
    );
}
