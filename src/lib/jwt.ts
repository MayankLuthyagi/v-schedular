import jwt from 'jsonwebtoken';

export interface JwtPayload {
    sub: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
}

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET is not configured.');
    }

    return secret;
};

export const signAuthToken = (payload: JwtPayload, expiresIn: string = '1d') => {
    return jwt.sign(payload, getJwtSecret(), { expiresIn });
};

export const verifyAuthToken = (token: string): JwtPayload | null => {
    try {
        return jwt.verify(token, getJwtSecret()) as JwtPayload;
    } catch {
        return null;
    }
};
