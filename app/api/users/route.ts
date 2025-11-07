import { NextRequest, NextResponse } from 'next/server';
import { db, getPaginationData } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { userQuerySchema } from '@/lib/validations';

// GET /api/users - List users with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate query parameters
    const validation = userQuerySchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid query parameters', 
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const {
      page = 1,
      limit = 20,
      search,
      isVerified,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validation.data;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isVerified !== undefined) {
      where.isVerified = isVerified;
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'username') {
      orderBy.username = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    }

    // Get total count for pagination
    const totalCount = await db.user.count({ where });

    // Get users with pagination
    const users = await db.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        bio: true,
        isVerified: true,
        createdAt: true,
        _count: {
          select: {
            ownedNFTs: true,
            nfts: true,
            collections: true,
            bids: true,
            transactions: true,
            auctions: true,
          }
        }
      }
    });

    // Calculate additional stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Get total sales volume
        const salesVolume = await db.transaction.aggregate({
          where: {
            userId: user.id,
            type: 'SALE',
          },
          _sum: {
            amount: true,
          }
        });

        // Get total purchase volume
        const purchaseVolume = await db.transaction.aggregate({
          where: {
            userId: user.id,
            type: 'SALE',
          },
          _sum: {
            amount: true,
          }
        });

        return {
          ...user,
          stats: {
            totalNFTs: user._count.ownedNFTs,
            createdNFTs: user._count.nfts,
            collections: user._count.collections,
            totalBids: user._count.bids,
            totalTransactions: user._count.transactions,
            totalAuctions: user._count.auctions,
            salesVolume: salesVolume._sum.amount || 0,
            purchaseVolume: purchaseVolume._sum.amount || 0,
          }
        };
      })
    );

    // Remove _count from response
    const finalUsers = usersWithStats.map(({ _count, ...user }) => user);

    // Get pagination data
    const pagination = getPaginationData(page, limit, totalCount);

    return NextResponse.json({
      success: true,
      users: finalUsers,
      pagination,
    });

  } catch (error: any) {
    console.error('Get users error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}