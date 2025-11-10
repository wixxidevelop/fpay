import { PrismaClient } from '@prisma/client';

declare global {
  var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db;
}

// Helper function to handle database errors
export function handleDatabaseError(error: any) {
  console.error('Database error:', error);
  
  if (error.code === 'P2002') {
    return {
      success: false,
      error: 'A record with this information already exists',
      details: error.meta?.target,
    };
  }
  
  // Column does not exist – typically indicates migrations not applied in the target database
  if (error.code === 'P2022') {
    return {
      success: false,
      error: 'Database schema mismatch: column not found. Apply migrations to the database.',
      details: error.meta,
    };
  }
  
  if (error.code === 'P2025') {
    return {
      success: false,
      error: 'Record not found',
      details: error.meta,
    };
  }
  
  if (error.code === 'P2003') {
    return {
      success: false,
      error: 'Foreign key constraint failed',
      details: error.meta,
    };
  }
  
  return {
    success: false,
    error: 'Database operation failed',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
  };
}

// Pagination helper
export function getPaginationData(page: number, limit: number, totalCount: number) {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;
  
  return {
    page,
    limit,
    totalCount,
    totalPages,
    hasNext,
    hasPrev,
  };
}

// Generate unique slug for collections
export async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  let slug = baseSlug;
  let counter = 1;
  
  while (await db.collection.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

// Generate unique token ID for NFTs
export async function generateUniqueTokenId(): Promise<string> {
  let tokenId: string;
  let exists = true;
  
  while (exists) {
    tokenId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const existing = await db.nFT.findUnique({ where: { tokenId } });
    exists = !!existing;
  }
  
  return tokenId!;
}
