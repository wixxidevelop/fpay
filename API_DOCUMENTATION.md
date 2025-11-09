# Etheryte NFT Marketplace API Documentation

## Overview

This document provides comprehensive documentation for all API routes and schemas used in the Etheryte NFT Marketplace. The API is built with Next.js 14 App Router and uses Prisma ORM with PostgreSQL.

## Base URL
```
https://your-domain.com/api
```

## Authentication

Most endpoints require authentication via JWT tokens stored in HTTP-only cookies. The authentication system uses:
- `auth-token`: Main authentication token
- `access-token`: Short-lived access token
- `refresh-token`: Long-lived refresh token
- `csrf-token`: CSRF protection token
- `user-data`: Encrypted user data

### Authentication & Token Requirements by Endpoint

The server reads tokens from cookies; you do not need to send Authorization headers. For authenticated routes, at least one of `access-token` (preferred) or `auth-token` must be present in the request cookies; admin routes additionally require `isAdmin: true` inside the JWT payload.

- General authenticated routes (cookies: `access-token` or `auth-token`):
  - POST /api/nfts
  - PUT /api/nfts/[id]
  - DELETE /api/nfts/[id]
  - POST /api/collections
  - PUT /api/collections/[id]
  - DELETE /api/collections/[id]
  - POST /api/auctions
  - POST /api/auctions/[id]/bid
  - POST /api/transactions
  - PUT /api/users/[id]

- Admin-only routes (cookies: `access-token` or `auth-token`, JWT must have `isAdmin: true`):
  - GET /api/admin/dashboard
  - GET /api/admin/settings
  - PUT /api/admin/settings

- Auth support routes:
  - GET /api/auth/me (cookies: `access-token` or `auth-token`)
  - POST /api/auth/refresh (cookie: `refresh-token` required; rotates all tokens)
  - POST /api/auth/logout (clears authentication-related cookies)

Notes:
- CSRF: A `csrf-token` cookie is issued for client-side protection. Current API endpoints validate authentication via cookies and do not require an explicit CSRF header in requests.

## Database Models

### User
```typescript
interface User {
  id: string
  email: string
  username: string
  firstName?: string
  lastName?: string
  walletAddress?: string
  preferredCurrency: string // 3-letter ISO code, e.g., 'USD'
  isVerified: boolean
  isAdmin: boolean
  avatar?: string
  bio?: string
  createdAt: Date
  updatedAt: Date
}
```

### NFT
```typescript
interface NFT {
  id: string
  tokenId: string
  name: string
  description?: string
  image: string
  price?: number
  category?: string
  isListed: boolean
  isSold: boolean
  creatorId: string
  collectionId?: string
  createdAt: Date
  updatedAt: Date
}
```

### Collection
```typescript
interface Collection {
  id: string
  name: string
  description?: string
  image?: string
  slug: string
  isVerified: boolean
  creatorId: string
  createdAt: Date
  updatedAt: Date
}
```

### Transaction
```typescript
interface Transaction {
  id: string
  nftId: string
  userId: string
  amount: number
  txHash: string
  type: 'SALE' | 'TRANSFER' | 'MINT'
  createdAt: Date
}
```

### Auction
```typescript
interface Auction {
  id: string
  nftId: string
  sellerId: string
  startPrice: number
  reservePrice?: number
  currentPrice: number
  startTime: Date
  endTime: Date
  isActive: boolean
  createdAt: Date
}
```

### Bid
```typescript
interface Bid {
  id: string
  auctionId: string
  nftId: string
  bidderId: string
  amount: number
  createdAt: Date
}
```

## Validation Schemas

The API uses Zod for validation with the following main schemas:

### User Schemas
```typescript
// Registration
userRegistrationSchema = {
  email: string (email format)
  username: string (3-30 chars, alphanumeric + underscore)
  password: string (min 8 chars)
  firstName?: string (max 50 chars)
  lastName?: string (max 50 chars)
  walletAddress?: string (Ethereum address format)
  preferredCurrency?: string // 3-letter ISO code; defaults to 'USD'
}

// Login
userLoginSchema = {
  identifier: string (email or username)
  password: string
}

// Update
userUpdateSchema = {
  firstName?: string
  lastName?: string
  bio?: string
  avatar?: string
  walletAddress?: string
  preferredCurrency?: string // 3-letter ISO code
}
```

### NFT Schemas
```typescript
// Create NFT
nftCreateSchema = {
  name: string (1-100 chars)
  description?: string (max 1000 chars)
  image: string (URL format)
  price?: number (positive)
  category?: string
  collectionId?: string (UUID)
}

// Update NFT
nftUpdateSchema = {
  name?: string
  description?: string
  price?: number
  isListed?: boolean
}
```

### Collection Schemas
```typescript
// Create Collection
collectionCreateSchema = {
  name: string (1-100 chars)
  description?: string (max 1000 chars)
  image?: string (URL format)
}

// Update Collection
collectionUpdateSchema = {
  name?: string
  description?: string
  image?: string
}
```

### Auction & Bid Schemas
```typescript
// Create Auction
auctionCreateSchema = {
  nftId: string (UUID)
  startingPrice: number (positive)
  reservePrice?: number (positive)
  duration: number (1-168 hours)
}

// Create Bid
bidCreateSchema = {
  auctionId: string (UUID)
  amount: number (positive)
}
```

### Transaction Schema
```typescript
transactionCreateSchema = {
  nftId: string (UUID)
  userId: string (UUID)
  amount: number (positive)
  transactionHash: string
  type: 'SALE' | 'TRANSFER' | 'MINT'
}
```

## API Routes

### Authentication Routes

#### POST /api/auth/register
Request Type (TS): UserRegistration
Register a new user account.

**Request Body:**
```typescript
{
  email: string
  username: string
  password: string
  firstName?: string
  lastName?: string
  walletAddress?: string // 0x... (Ethereum address)
  preferredCurrency?: string // e.g., 'USD', 'EUR'; defaults to 'USD'
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  user: Omit<User, 'passwordHash'>
}
```

**Status Codes:**
- 201: User created successfully
- 400: Validation error or user already exists
- 500: Internal server error

#### POST /api/auth/login
Request Type (TS): UserLogin
Authenticate user and create session.

**Request Body:**
```typescript
{
  emailOrUsername: string
  password: string
  rememberMe?: boolean
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  user: Omit<User, 'passwordHash'>
}
```

Notes:
- Sets cookies: `auth-token`, `access-token`, `refresh-token`, `csrf-token`, `user-data`.

**Status Codes:**
- 200: Login successful
- 400: Invalid credentials or validation error
- 429: Too many failed attempts
- 500: Internal server error

#### POST /api/auth/logout
Request Type (TS): none
Logout user and invalidate session.

**Response:**
```typescript
{
  success: boolean
  message: string
}
```

Notes:
- Clears cookies: `auth-token`, `access-token`, `refresh-token`, `csrf-token`, `user-data`.

**Status Codes:**
- 200: Logout successful
- 500: Internal server error

#### GET /api/auth/me
Request Type (TS): none
Get current authenticated user information.

**Response:**
```typescript
{
  success: boolean
  user: {
    id: string
    username: string
    email: string
    firstName?: string | null
    lastName?: string | null
    bio?: string | null
    isAdmin: boolean
    isVerified: boolean
    avatar?: string | null
    walletAddress?: string | null
    preferredCurrency: string
    createdAt: string
    updatedAt: string
    stats: {
      nftsCreated: number
      nftsOwned: number
      collectionsCreated: number
      bidsPlaced: number
      transactions: number
      auctions: number
    }
  }
}
```

**Status Codes:**
- 200: User data retrieved
- 401: Not authenticated
- 500: Internal server error

#### POST /api/auth/refresh
Request Type (TS): none
Refresh access tokens using refresh token.

**Response:**
```typescript
{
  success: boolean
  message: string
  user: Omit<User, 'passwordHash'>
}
```

Notes:
- Rotates and resets cookies: `auth-token`, `access-token`, `refresh-token`, `csrf-token`, `user-data`.

**Status Codes:**
- 200: Tokens refreshed
- 401: Invalid refresh token
- 500: Internal server error

### System Routes

#### GET /api/system/currencies
Request Type (TS): none
Returns the list of supported world currencies.

**Response:**
```typescript
{
  success: boolean
  currencies: Array<{ code: string; name: string; symbol: string }>
}
```

Notes:
- Use this endpoint to populate the “Preferred Currency” dropdown in the registration UI.
- Send the selected `code` back in registration or profile update.

### NFT Routes

#### GET /api/nfts
Query Type (TS): NFTQuery
List NFTs with filtering and pagination.

**Query Parameters:**
- `page?: number` (default: 1)
- `limit?: number` (default: 20, max: 100)
- `category?: string`
- `minPrice?: number`
- `maxPrice?: number`
- `isListed?: boolean`
- `creatorId?: string`
- `ownerId?: string`
- `collectionId?: string`
- `search?: string`
- `sortBy?: string` (default: 'createdAt')
- `sortOrder?: 'asc' | 'desc'` (default: 'desc')

**Response:**
```typescript
{
  success: boolean
  data: {
    nfts: NFT[]
    pagination: {
      page: number
      limit: number
      totalCount: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }
}
```

#### POST /api/nfts
Request Type (TS): NFTCreate
Create a new NFT. Requires authentication.

**Request Body:**
```typescript
{
  name: string
  description?: string
  image: string
  price?: number
  category?: string
  collectionId?: string
}
```

**Response:**
```typescript
{
  success: boolean
  data: NFT
}
```

**Status Codes:**
- 201: NFT created successfully
- 400: Validation error
- 401: Not authenticated
- 500: Internal server error

#### GET /api/nfts/[id]
Request Type (TS): none
Get specific NFT with related data.

**Response:**
```typescript
{
  success: boolean
  data: {
    nft: NFT & {
      creator: User
      collection?: Collection
      transactions: Transaction[]
      activeAuctions: Auction[]
    }
    similarNFTs: NFT[]
  }
}
```

**Status Codes:**
- 200: NFT retrieved
- 404: NFT not found
- 500: Internal server error

#### PUT /api/nfts/[id]
Request Type (TS): NFTUpdate
Update NFT. Requires authentication and ownership.

**Request Body:**
```typescript
{
  name?: string
  description?: string
  price?: number
  isListed?: boolean
}
```

**Response:**
```typescript
{
  success: boolean
  data: NFT
}
```

**Status Codes:**
- 200: NFT updated
- 400: Validation error
- 401: Not authenticated
- 403: Not authorized (not owner)
- 404: NFT not found
- 500: Internal server error

#### DELETE /api/nfts/[id]
Request Type (TS): none
Delete NFT. Requires authentication and ownership.

**Response:**
```typescript
{
  success: boolean
  data: {
    message: string
  }
}
```

**Status Codes:**
- 200: NFT deleted
- 401: Not authenticated
- 403: Not authorized or NFT has active auctions
- 404: NFT not found
- 500: Internal server error

### Collection Routes

#### GET /api/collections
Query Type (TS): CollectionQuery
List collections with filtering and pagination.

**Query Parameters:**
- `page?: number`
- `limit?: number`
- `creatorId?: string`
- `query?: string` (search term)
- `sortBy?: string`
- `sortOrder?: 'asc' | 'desc'`

**Response:**
```typescript
{
  success: boolean
  data: {
    collections: (Collection & {
      creator: User
      stats: {
        totalNFTs: number
        floorPrice: number
        avgPrice: number
        maxPrice: number
        totalVolume: number
      }
    })[]
    pagination: PaginationInfo
  }
}
```

#### POST /api/collections
Request Type (TS): CollectionCreate
Create a new collection. Requires authentication.

**Request Body:**
```typescript
{
  name: string
  description?: string
  image?: string
}
```

**Response:**
```typescript
{
  success: boolean
  data: Collection
}
```

#### GET /api/collections/[id]
Request Type (TS): none
Get specific collection with NFTs and statistics.

**Response:**
```typescript
{
  success: boolean
  data: {
    collection: Collection & {
      creator: User
      nfts: NFT[]
      stats: CollectionStats
    }
  }
}
```

#### PUT /api/collections/[id]
Request Type (TS): CollectionUpdate
Update collection. Requires authentication and ownership or admin role.

**Request Body:**
```typescript
{
  name?: string
  description?: string
  image?: string
  isVerified?: boolean // Admin only
}
```

#### DELETE /api/collections/[id]
Request Type (TS): none
Delete collection. Requires authentication and ownership or admin role.

### Auction Routes

#### GET /api/auctions
Query Type (TS): AuctionQuery
List auctions with filtering and pagination.

**Query Parameters:**
- `page?: number`
- `limit?: number`
- `isActive?: boolean`
- `creatorId?: string`
- `category?: string`
- `minPrice?: number`
- `maxPrice?: number`
- `sortBy?: string`
- `sortOrder?: 'asc' | 'desc'`

**Response:**
```typescript
{
  success: boolean
  data: {
    auctions: (Auction & {
      nft: NFT & { creator: User }
      bids: (Bid & { bidder: User })[]
      _count: { bids: number }
    })[]
    pagination: PaginationInfo
  }
}
```

#### POST /api/auctions
Request Type (TS): AuctionCreate
Create a new auction. Requires authentication and NFT ownership.

**Request Body:**
```typescript
{
  nftId: string
  startingPrice: number
  reservePrice?: number
  duration: number // hours
}
```

**Response:**
```typescript
{
  success: boolean
  data: Auction & {
    nft: NFT & { creator: User }
  }
}
```

#### GET /api/auctions/[id]/bid
Request Type (TS): none
Get bids for a specific auction.

**Response:**
```typescript
{
  success: boolean
  data: {
    auction: {
      id: string
      nft: NFT
      currentPrice: number
      endTime: Date
      isActive: boolean
    }
    bids: (Bid & { bidder: User })[]
    totalBids: number
    highestBid: Bid | null
  }
}
```

#### POST /api/auctions/[id]/bid
Request Type (TS): BidCreate
Place a bid on an auction. Requires authentication.

**Request Body:**
```typescript
{
  amount: number
}
```

**Response:**
```typescript
{
  success: boolean
  data: Bid & {
    bidder: User
    auction: Auction & { nft: NFT }
  }
}
```

### Transaction Routes

#### GET /api/transactions
Query Type (TS): TransactionQuery
List transactions with filtering and pagination.

**Query Parameters:**
- `page?: number`
- `limit?: number`
- `userId?: string`
- `nftId?: string`
- `type?: 'SALE' | 'TRANSFER' | 'MINT'`
- `minAmount?: number`
- `maxAmount?: number`
- `sortBy?: string`
- `sortOrder?: 'asc' | 'desc'`

**Response:**
```typescript
{
  success: boolean
  data: {
    transactions: (Transaction & {
      nft: NFT
      user: User
    })[]
    pagination: PaginationInfo
  }
}
```

#### POST /api/transactions
Request Type (TS): TransactionCreate
Create a new transaction. Requires authentication.

**Request Body:**
```typescript
{
  nftId: string
  userId: string
  amount: number
  transactionHash: string
  type: 'SALE' | 'TRANSFER' | 'MINT'
}
```

**Response:**
```typescript
{
  success: boolean
  data: Transaction & {
    nft: NFT
    user: User
  }
}
```

### User Routes

#### GET /api/users
Query Type (TS): UserQuery
List users with filtering and pagination. Public.

**Query Parameters:**
- `page?: number` Default: 1
- `limit?: number` Default: 20 (max 100)
- `search?: string` Search by username, email, or bio
- `isVerified?: boolean`
- `sortBy?: 'createdAt' | 'username'` Default: 'createdAt'
- `sortOrder?: 'asc' | 'desc'` Default: 'desc'

**Response:**
```typescript
{
  success: boolean
  users: Array<{
    id: string
    username: string
    email: string
    avatar?: string | null
    bio?: string | null
    isVerified: boolean
    createdAt: string
    stats: {
      totalNFTs: number
      createdNFTs: number
      collections: number
      totalBids: number
      totalTransactions: number
      totalAuctions: number
      salesVolume: number
      purchaseVolume: number
    }
  }>
  pagination: PaginationInfo
}
```

#### GET /api/users/[id]
Request Type (TS): none
Get user profile with statistics and recent activity. Public.

**Response:**
```typescript
{
  success: boolean
  user: {
    id: string
    username: string
    email: string
    avatar?: string | null
    bio?: string | null
    walletAddress?: string | null
    preferredCurrency: string
    isVerified: boolean
    createdAt: string
    stats: {
      totalNFTs: number
      createdNFTs: number
      collections: number
      totalBids: number
      totalTransactions: number
      totalAuctions: number
      salesVolume: number
      purchaseVolume: number
      totalEarnings: number
    }
    recentNFTs: Array<{
      id: string
      name: string
      image: string
      price?: number | null
      tokenId: string
    }>
    recentCollections: Array<{
      id: string
      name: string
      description?: string | null
      image?: string | null
      _count: { nfts: number }
    }>
    recentActivity: Array<{
      id: string
      amount: number
      type: 'SALE' | 'TRANSFER' | 'MINT'
      createdAt: string
      nft: { id: string, name: string, image: string, tokenId: string }
      user: { id: string, username: string }
    }>
  }
}
```

#### PUT /api/users/[id]
Request Type (TS): UserUpdate
Update user profile. Requires authentication and ownership or admin role.

**Request Body:**
```typescript
{
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  bio?: string
  avatar?: string
  walletAddress?: string
  preferredCurrency?: string
}
```

### Admin Routes

#### GET /api/admin/dashboard
Request Type (TS): none
Get admin dashboard statistics. Requires admin role.

**Response:**
```typescript
{
  success: boolean
  stats: {
    overview: {
      totalUsers: number
      totalNFTs: number
      totalCollections: number
      totalTransactions: number
      totalAuctions: number
      totalBids: number
      activeAuctions: number
      platformRevenue: number // 2.5% of total SALE volume
    }
    today: {
      newUsers: number
      newNFTs: number
      transactions: number
      volume: number
    }
    thisWeek: {
      newUsers: number
      newNFTs: number
      transactions: number
      volume: number
    }
    thisMonth: {
      newUsers: number
      newNFTs: number
      transactions: number
      volume: number
    }
    thisYear: {
      volume: number
    }
    growth: {
      userGrowthRate: number
      nftGrowthRate: number
      volumeGrowthRate: number
    }
    topCollections: Array<{
      id: string
      name: string
      image?: string | null
      _count: { nfts: number }
    }>
    topUsers: Array<{
      id: string
      username: string
      avatar?: string | null
      isVerified: boolean
      _count: { transactions: number }
    }>
    recentTransactions: Array<{
      id: string
      amount: number
      type: 'SALE' | 'TRANSFER' | 'MINT'
      createdAt: string
      nft: { id: string, name: string, image: string, tokenId: string }
      user: { id: string, username: string, avatar?: string | null }
    }>
  }
}
```

#### GET /api/admin/settings
Request Type (TS): none
Get system settings. Requires admin role.

**Response:**
```typescript
{
  success: boolean
  settings: Record<string, {
    value: string
    description?: string
    updatedAt?: string
  }>
}
```

Notes:
- Includes defaults if no settings exist (e.g., platformFeePercentage, maxFileSize, allowedFileTypes, minAuctionDuration, maxAuctionDuration, maintenanceMode, registrationEnabled, emailVerificationRequired, maxBidsPerUser, featuredCollectionLimit).

#### PUT /api/admin/settings
Request Type (TS): SystemSettingUpdate
Update system settings. Requires admin role.

**Request Body:**
```typescript
{
  settings: Array<{ key: string; value: string }>
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  settings: Record<string, {
    value: string
    description?: string
    updatedAt?: string
  }>
}
```

Notes:
- Updates existing keys or creates new ones.
- Validates body with `systemSettingUpdateSchema` (requires at least one `{ key, value }`).
## Error Responses

All endpoints return errors in the following format:

```typescript
{
  success: false
  error: string
  details?: any
}
```

### Common Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation error)
- **401**: Unauthorized (not authenticated)
- **403**: Forbidden (not authorized)
- **404**: Not Found
- **405**: Method Not Allowed
- **409**: Conflict (duplicate resource)
- **429**: Too Many Requests (rate limited)
- **500**: Internal Server Error

## Rate Limiting

The API implements rate limiting on sensitive endpoints:
- Authentication endpoints: 5 requests per minute per IP
- User registration: 3 requests per hour per IP
- Password reset: 3 requests per hour per email

## Pagination

Most list endpoints support pagination with the following parameters:

```typescript
{
  page?: number // default: 1
  limit?: number // default: 20, max: 100
  sortBy?: string // default: 'createdAt'
  sortOrder?: 'asc' | 'desc' // default: 'desc'
}
```

Response includes pagination metadata:

```typescript
{
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
```

## Security Features

- JWT-based authentication with HTTP-only cookies
- CSRF protection
- Rate limiting
- Input validation with Zod
- SQL injection prevention via Prisma ORM
- Role-based access control (User/Admin)
- Secure password hashing
- Email verification system

## Environment Variables

Required environment variables:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development

To run the API locally:

1. Install dependencies: `npm install`
2. Set up environment variables
3. Run database migrations: `npx prisma migrate dev`
4. Generate Prisma client: `npx prisma generate`
5. Start development server: `npm run dev`

## Testing

The API includes comprehensive testing with Jest and Supertest. Run tests with:

```bash
npm test
```

## Deployment

The API is designed to be deployed on Vercel with PostgreSQL database. Ensure all environment variables are configured in your deployment environment.
