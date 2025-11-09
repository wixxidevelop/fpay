import { z } from 'zod';
import { isValidCurrency } from './currencies';

// User Validation Schemas
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().max(50, 'First name must be at most 50 characters').optional(),
  lastName: z.string().max(50, 'Last name must be at most 50 characters').optional(),
  walletAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
    .optional(),
  preferredCurrency: z.string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((v) => v.toUpperCase())
    .refine((v) => isValidCurrency(v), 'Invalid currency code')
    .optional()
    .default('USD'),
});

export const userLoginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  email: z.string().email('Invalid email format').optional(),
  firstName: z.string().max(50, 'First name must be at most 50 characters').optional(),
  lastName: z.string().max(50, 'Last name must be at most 50 characters').optional(),
  bio: z.string().max(1000, 'Bio must be at most 1000 characters').optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
  walletAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
    .optional(),
  preferredCurrency: z.string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((v) => v.toUpperCase())
    .refine((v) => isValidCurrency(v), 'Invalid currency code')
    .optional(),
  // Admin-only fields
  isVerified: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
});

// NFT Validation Schemas
export const nftCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z.string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional(),
  image: z.string().url('Invalid image URL'),
  price: z.number().positive('Price must be positive').optional(),
  category: z.string().optional(),
  collectionId: z.string().optional(),
});

export const nftUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  description: z.string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional(),
  price: z.number().positive('Price must be positive').optional(),
  isListed: z.boolean().optional(),
});

// Collection Validation Schemas
export const collectionCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z.string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional(),
  image: z.string().url('Invalid image URL').optional(),
});

export const collectionUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  description: z.string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional(),
  image: z.string().url('Invalid image URL').optional(),
  isVerified: z.boolean().optional(), // Admin only
});

// Auction Validation Schemas
export const auctionCreateSchema = z.object({
  nftId: z.string().min(1, 'NFT ID is required'),
  startingPrice: z.number().positive('Starting price must be positive'),
  reservePrice: z.number().positive('Reserve price must be positive').optional(),
  duration: z.number()
    .min(1, 'Duration must be at least 1 hour')
    .max(168, 'Duration must be at most 168 hours (7 days)'),
});

// Bid Validation Schemas
export const bidCreateSchema = z.object({
  auctionId: z.string().min(1, 'Auction ID is required'),
  amount: z.number().positive('Bid amount must be positive'),
});

// Transaction Validation Schemas
export const transactionCreateSchema = z.object({
  nftId: z.string().optional(),
  userId: z.string().min(1, 'User ID is required'),
  amount: z.number().positive('Amount must be positive'),
  transactionHash: z.string().min(1, 'Transaction hash is required'),
  type: z.enum(['SALE', 'TRANSFER', 'MINT', 'DEPOSIT', 'WITHDRAWAL'] as const),
});

// Stock purchase payload
export const stockPurchaseCreateSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  amountUSD: z.number().positive('Amount must be positive'),
  priceUSD: z.number().positive('Price must be positive'),
  shares: z.number().positive('Shares must be positive'),
  date: z.number().optional(), // epoch ms
});

// Query Parameter Validation Schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().min(1).max(100, 'Limit must be between 1 and 100').default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc'] as const).default('desc'),
});

export const nftQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  isListed: z.coerce.boolean().optional(),
  creatorId: z.string().optional(),
  ownerId: z.string().optional(),
  collectionId: z.string().optional(),
  search: z.string().optional(),
});

export const collectionQuerySchema = paginationSchema.extend({
  creatorId: z.string().optional(),
  query: z.string().optional(),
});

export const auctionQuerySchema = paginationSchema.extend({
  isActive: z.coerce.boolean().optional(),
  creatorId: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
});

export const transactionQuerySchema = paginationSchema.extend({
  userId: z.string().optional(),
  nftId: z.string().optional(),
  type: z.enum(['SALE', 'TRANSFER', 'MINT'] as const).optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
});

export const userQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  role: z.string().optional(),
  isVerified: z.coerce.boolean().optional(),
});

// Admin Validation Schemas
export const systemSettingCreateSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
  description: z.string().optional(),
  category: z.string().optional(),
});

export const systemSettingUpdateSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1, 'Key is required'),
    value: z.string().min(1, 'Value is required'),
  })).min(1, 'At least one setting is required'),
});

// Type exports for TypeScript
export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type NFTCreate = z.infer<typeof nftCreateSchema>;
export type NFTUpdate = z.infer<typeof nftUpdateSchema>;
export type CollectionCreate = z.infer<typeof collectionCreateSchema>;
export type CollectionUpdate = z.infer<typeof collectionUpdateSchema>;
export type AuctionCreate = z.infer<typeof auctionCreateSchema>;
export type BidCreate = z.infer<typeof bidCreateSchema>;
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type NFTQuery = z.infer<typeof nftQuerySchema>;
export type CollectionQuery = z.infer<typeof collectionQuerySchema>;
export type AuctionQuery = z.infer<typeof auctionQuerySchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;
export type SystemSettingCreate = z.infer<typeof systemSettingCreateSchema>;
export type SystemSettingUpdate = z.infer<typeof systemSettingUpdateSchema>;
export type StockPurchaseCreate = z.infer<typeof stockPurchaseCreateSchema>;
