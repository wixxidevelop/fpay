import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import CryptoJS from 'crypto-js';

// Use safe dev defaults if env vars are missing to prevent runtime 500s
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const CSRF_SECRET = process.env.CSRF_SECRET || 'dev_csrf_secret';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'dev_encryption_key';

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// JWT utilities
export function generateTokens(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  const authToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
  
  return { accessToken, refreshToken, authToken };
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// CSRF utilities
export function generateCSRFToken(): string {
  return CryptoJS.lib.WordArray.random(32).toString();
}

export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  return token === sessionToken;
}

// Encryption utilities
export function encryptData(data: string): string {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
}

export function decryptData(encryptedData: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decoded = bytes.toString(CryptoJS.enc.Utf8);
    // If decryption succeeds but yields empty/invalid UTF-8, return empty string
    return decoded || '';
  } catch (error) {
    // Gracefully handle malformed ciphertext or wrong key without throwing
    // This prevents 500s in routes that decrypt stored values
    return '';
  }
}

// Cookie utilities
export function setAuthCookies(response: NextResponse, tokens: ReturnType<typeof generateTokens>, userData: any) {
  const csrfToken = generateCSRFToken();
  const encryptedUserData = encryptData(JSON.stringify(userData));

  const isProd = process.env.NODE_ENV === 'production';
  // In production, use SameSite=None + Secure for cross-site; in dev, use Lax without Secure
  const sameSite: 'strict' | 'lax' | 'none' = isProd ? 'none' : 'lax';
  const secure = isProd; // Only secure in production; dev runs on http://localhost
  
  // Set HTTP-only cookies
  response.cookies.set('auth-token', tokens.authToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 24 * 60 * 60, // 1 day
    path: '/',
  });
  
  response.cookies.set('access-token', tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  });
  
  response.cookies.set('refresh-token', tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
  
  response.cookies.set('csrf-token', csrfToken, {
    httpOnly: false, // Accessible to client for CSRF protection
    secure,
    sameSite,
    maxAge: 24 * 60 * 60, // 1 day
    path: '/',
  });
  
  response.cookies.set('user-data', encryptedUserData, {
    httpOnly: false, // Accessible to client
    secure,
    sameSite,
    maxAge: 24 * 60 * 60, // 1 day
    path: '/',
  });
}

export function clearAuthCookies(response: NextResponse) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  };
  
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set('access-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set('refresh-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
    maxAge: 0,
    path: '/',
  });
  response.cookies.set('csrf-token', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set('user-data', '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 0,
    path: '/',
  });
}

// Authentication middleware
export async function getAuthenticatedUser(request: NextRequest): Promise<JWTPayload | null> {
  console.log(request)
  const authToken = request.cookies.get('auth-token')?.value;
  const accessToken = request.cookies.get('access-token')?.value;
  
  // Try access token first (most recent)
  if (accessToken) {
    const payload = verifyToken(accessToken);
    if (payload) return payload;
  }
  
  // Fall back to auth token
  if (authToken) {
    const payload = verifyToken(authToken);
    if (payload) return payload;
  }
  
  return null;
}

export async function requireAuth(request: NextRequest): Promise<{ user: JWTPayload } | { error: NextResponse }> {
  const user = await getAuthenticatedUser(request);
  
  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }
  
  return { user };
}

export async function requireAdmin(request: NextRequest): Promise<{ user: JWTPayload } | { error: NextResponse }> {
  const authResult = await requireAuth(request);
  
  if ('error' in authResult) {
    return authResult;
  }
  
  if (!authResult.user.isAdmin) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      ),
    };
  }
  
  return authResult;
}

// Rate limiting utilities
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(identifier: string, maxRequests: number, windowMs: number): { success: boolean; resetTime: number; count: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean up old entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetTime < now) {
      rateLimitMap.delete(key);
    }
  }
  
  const current = rateLimitMap.get(identifier);
  
  if (!current) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, resetTime: windowMs, count: 1 };
  }
  
  if (current.resetTime < now) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, resetTime: windowMs, count: 1 };
  }
  
  if (current.count >= maxRequests) {
    return { success: false, resetTime: current.resetTime - now, count: current.count };
  }
  
  current.count++;
  return { success: true, resetTime: current.resetTime - now, count: current.count };
}

// User validation utilities
export async function validateUserOwnership(userId: string, resourceUserId: string, isAdmin: boolean = false): Promise<boolean> {
  return userId === resourceUserId || isAdmin;
}

export async function validateNFTOwnership(userId: string, nftId: string, isAdmin: boolean = false): Promise<boolean> {
  if (isAdmin) return true;
  
  const nft = await db.nFT.findUnique({
    where: { id: nftId },
    select: { creatorId: true, ownerId: true },
  });
  
  return nft ? (nft.creatorId === userId || nft.ownerId === userId) : false;
}

export async function validateCollectionOwnership(userId: string, collectionId: string, isAdmin: boolean = false): Promise<boolean> {
  if (isAdmin) return true;
  
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: { creatorId: true },
  });
  
  return collection ? collection.creatorId === userId : false;
}