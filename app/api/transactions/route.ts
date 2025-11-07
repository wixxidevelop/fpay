import { NextRequest, NextResponse } from 'next/server';
import { db, getPaginationData } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { transactionQuerySchema, transactionCreateSchema } from '@/lib/validations';
import { v4 as uuidv4 } from 'uuid';

// GET /api/transactions - List transactions with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // Validate query parameters
    const validation = transactionQuerySchema.safeParse(queryParams);
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
      type,
      nftId,
      userId,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validation.data;

    // Build where clause
    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (nftId) {
      where.nftId = nftId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      where.amount = {};
      if (minAmount !== undefined) where.amount.gte = minAmount;
      if (maxAmount !== undefined) where.amount.lte = maxAmount;
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'amount') {
      orderBy.amount = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    }

    // Get total count for pagination
    const totalCount = await db.transaction.count({ where });

    // Get transactions with pagination
    const transactions = await db.transaction.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        nft: {
          select: {
            id: true,
            name: true,
            image: true,
            tokenId: true,
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
          }
        }
      }
    });

    // Get pagination data
    const pagination = getPaginationData(page, limit, totalCount);

    return NextResponse.json({
      success: true,
      transactions,
      pagination,
    });

  } catch (error: any) {
    console.error('Get transactions error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/transactions - Create new transaction (admin only)
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { user } = authResult;
    
    // Only admins can manually create transactions
    if (!user.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validation = transactionCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed', 
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const {
      type,
      nftId,
      userId,
      amount,
      transactionHash,
    } = validation.data;

    // Validate NFT exists if provided
    if (nftId) {
      const nft = await db.nFT.findUnique({
        where: { id: nftId },
        select: { id: true, name: true }
      });
      if (!nft) {
        return NextResponse.json(
          { success: false, error: 'NFT not found' },
          { status: 404 }
        );
      }
    }

    // Validate user exists
    const transactionUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!transactionUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Create transaction
    const createData: any = {
      id: uuidv4(),
      type,
      userId,
      amount,
      transactionHash,
    };
    if (nftId) {
      createData.nftId = nftId;
    }

    try {
      const transaction = await db.transaction.create({
        data: createData,
        include: {
          nft: {
            select: {
              id: true,
              name: true,
              image: true,
              tokenId: true,
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Transaction created successfully',
        transaction,
      }, { status: 201 });
    } catch (err: any) {
      // Handle known Prisma errors (e.g., unique constraint on transactionHash)
      if (err.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Duplicate transaction hash' },
          { status: 400 }
        );
      }
      console.error('Create transaction DB error:', err);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Create transaction error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}