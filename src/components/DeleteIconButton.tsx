'use client';

import type { ButtonHTMLAttributes } from 'react';
import { FiTrash2 } from 'react-icons/fi';

interface DeleteIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
    label?: string;
}

export default function DeleteIconButton({
    label = 'Delete',
    className = '',
    ...props
}: DeleteIconButtonProps) {
    return (
        <div className="group relative inline-flex">
            <button
                type="button"
                aria-label={label}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 text-red-600 border-red-200 ${className}`.trim()}
                style={{
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    borderColor: 'rgba(220, 38, 38, 0.2)',
                    boxShadow: '0 8px 20px rgba(220, 38, 38, 0.12)',
                }}
                {...props}
            >
                <FiTrash2 className="h-4 w-4" />
            </button>
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 translate-y-1 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-md transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {label}
            </span>
        </div>
    );
}
