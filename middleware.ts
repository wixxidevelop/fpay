import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/auth';

// Rate limiting configuration for different endpoints
const rateLimitConfig = {
  // Authentication endpoints - stricter limits
  '/api/auth/register': { requests: 5, window: 15 * 60 * 1000 }, // 5 requests per 15 minutes
  '/api/auth/login': { requests: 10, window: 15 * 60 * 1000 }, // 10 requests per 15 minutes
  '/api/auth/refresh': { requests: 20, window: 15 * 60 * 1000 }, // 20 requests per 15 minutes
  
  // NFT operations - moderate limits
  '/api/nfts': { requests: 100, window: 15 * 60 * 1000 }, // 100 requests per 15 minutes
  '/api/collections': { requests: 50, window: 15 * 60 * 1000 }, // 50 requests per 15 minutes
  
  // Auction and bidding - moderate limits
  '/api/auctions': { requests: 50, window: 15 * 60 * 1000 }, // 50 requests per 15 minutes
  '/api/auctions/*/bid': { requests: 20, window: 15 * 60 * 1000 }, // 20 bids per 15 minutes
  
  // Admin endpoints - stricter limits
  '/api/admin/*': { requests: 30, window: 15 * 60 * 1000 }, // 30 requests per 15 minutes
  
  // Default for other API endpoints
  '/api/*': { requests: 200, window: 15 * 60 * 1000 }, // 200 requests per 15 minutes
};

const allowedOrigins = ['https://acme.com', 'https://my-app.org']

const corsOptions = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control',
  'Access-Control-Allow-Credentials': 'true'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check the origin from the request
  const origin = request.headers.get('origin') ?? ''
  const isAllowedOrigin = true;
  // Handle preflighted requests
  const isPreflight = request.method === 'OPTIONS'

  if (isPreflight) {
    const preflightHeaders = {
      ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
      ...corsOptions,
    }
    return NextResponse.json({}, { headers: preflightHeaders })
  }

  // Handle simple requests
  let response = NextResponse.next()

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }

  Object.entries(corsOptions).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  

  return response;
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
