/**
 * Utility functions for theme management
 */

/**
 * Converts hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Converts a hex color into an rgba() string with the requested alpha.
 */
export function hexToRgba(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return `rgba(59, 130, 246, ${alpha})`;

    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Generates lighter and darker variants of a color
 */
export function generateColorVariants(hex: string) {
    const rgb = hexToRgb(hex);
    if (!rgb) return { light: hex, dark: hex };

    // Generate lighter version (add 40 to each component, max 255)
    const lightR = Math.min(255, rgb.r + 40);
    const lightG = Math.min(255, rgb.g + 40);
    const lightB = Math.min(255, rgb.b + 40);
    const light = `#${lightR.toString(16).padStart(2, '0')}${lightG.toString(16).padStart(2, '0')}${lightB.toString(16).padStart(2, '0')}`;

    // Generate darker version (subtract 40 from each component, min 0)
    const darkR = Math.max(0, rgb.r - 40);
    const darkG = Math.max(0, rgb.g - 40);
    const darkB = Math.max(0, rgb.b - 40);
    const dark = `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;

    return { light, dark };
}

/**
 * Apply theme color to CSS variables
 */
export function applyThemeColor(color: string) {
    const variants = generateColorVariants(color);

    document.documentElement.style.setProperty('--theme-color', color);
    document.documentElement.style.setProperty('--theme-color-light', variants.light);
    document.documentElement.style.setProperty('--theme-color-dark', variants.dark);
}

/**
 * Get contrasting text color for a background color
 */
export function getContrastColor(hex: string): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return '#000000';

    // Calculate relative luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

    // Return white for dark backgrounds, black for light backgrounds
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Validate if a string is a valid hex color
 */
export function isValidHexColor(hex: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}
