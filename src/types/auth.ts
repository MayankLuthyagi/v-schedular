export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
}

export interface AuthEmail {
    _id: string;
    name: string;
    main: string;
    email: string;
    app_password: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface AuthResponse {
    success: boolean;
    emails?: AuthEmail[];
    error?: string;
}

export interface LoginState {
    isLoading: boolean;
    error: string;
}