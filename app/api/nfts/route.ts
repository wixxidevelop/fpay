import { NextRequest, NextResponse } from 'next/server';
import { db, getPaginationData } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { nftQuerySchema, nftCreateSchema } from '@/lib/validations';
import { generateUniqueTokenId } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET /api/nfts - List NFTs with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    
    // Convert string numbers to actual numbers for validation
    const queryParams = {
      ...rawParams,
      ...(rawParams.page && { page: parseInt(rawParams.page) }),
      ...(rawParams.limit && { limit: parseInt(rawParams.limit) }),
      ...(rawParams.minPrice && { minPrice: parseFloat(rawParams.minPrice) }),
      ...(rawParams.maxPrice && { maxPrice: parseFloat(rawParams.maxPrice) }),
    };

    // Validate query parameters
    const validation = nftQuerySchema.safeParse(queryParams);
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
      limit = 10,
      search,
      isListed,
      category,
      collectionId,
      creatorId,
      ownerId,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validation.data;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { creator: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (collectionId) {
      where.collectionId = collectionId;
    }

    if (creatorId) {
      where.creatorId = creatorId;
    }

    if (ownerId) {
      where.ownerId = ownerId;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    if (isListed !== undefined) {
      where.isListed = isListed;
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'price') {
      orderBy.price = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'updatedAt') {
      orderBy.updatedAt = sortOrder;
    }

    // Get total count for pagination
    const totalCount = await db.nFT.count({ where });

    // Get NFTs with pagination
    const nfts = await db.nFT.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            avatar: true,
          }
        },
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true,
          }
        },
        collection: {
          select: {
            id: true,
            name: true,
          }
        },
        _count: {
          select: {
            transactions: true,
          }
        }
      }
    });

    // Get pagination data
    const pagination = getPaginationData(page, limit, totalCount);

    return NextResponse.json({
      success: true,
      nfts,
      pagination,
    });

  } catch (error: any) {
    console.error('Get NFTs error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/nfts - Create new NFT
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { user } = authResult;
    const body = await request.json();
    
    // Validate request body
    const validation = nftCreateSchema.safeParse(body);
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
      name,
      description,
      image,
      category,
      price,
      collectionId,
    } = validation.data;

    // Minting fee (match UI note of 0.1 ETH; stored as numeric units)
    const MINT_FEE = 0.1;

    // Validate collection ownership if collectionId is provided
    if (collectionId) {
      const collection = await db.collection.findUnique({
        where: { id: collectionId },
        select: { creatorId: true }
      });

      if (!collection) {
        return NextResponse.json(
          { success: false, error: 'Collection not found' },
          { status: 404 }
        );
      }

      if (collection.creatorId !== user.userId && !user.isAdmin) {
        return NextResponse.json(
          { success: false, error: 'You can only add NFTs to your own collections' },
          { status: 403 }
        );
      }
    }

    // Compute current wallet balance (DEPOSIT credits minus WITHDRAWAL and MINT debits)
    const [creditsAgg, withdrawalsAgg, mintsAgg] = await Promise.all([
      db.transaction.aggregate({
        where: { userId: user.userId, type: 'DEPOSIT' },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { userId: user.userId, type: 'WITHDRAWAL' },
        _sum: { amount: true },
      }),
      db.transaction.aggregate({
        where: { userId: user.userId, type: 'MINT' },
        _sum: { amount: true },
      }),
    ]);

    const credits = creditsAgg._sum.amount || 0;
    const debits = (withdrawalsAgg._sum.amount || 0) + (mintsAgg._sum.amount || 0);
    const availableBalance = credits - debits;

    // Validate sufficient balance
    if (availableBalance < MINT_FEE) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient balance for NFT creation',
          requiredAmount: MINT_FEE,
          availableBalance,
        },
        { status: 400 }
      );
    }

    // Generate unique token ID
    const tokenId = await generateUniqueTokenId();

    // Atomic transaction: create NFT and log MINT fee deduction
    const txHash = uuidv4();
    const [nft, mintTx] = await db.$transaction([
      db.nFT.create({
        data: {
          id: uuidv4(),
          tokenId,
          name,
          description,
          image,
          category,
          price,
          isListed: true,
          isSold: false,
          creatorId: user.userId,
          ownerId: user.userId,
          collectionId,
        },
        include: {
          creator: { select: { id: true, username: true, avatar: true } },
          owner:   { select: { id: true, username: true, avatar: true } },
          collection: { select: { id: true, name: true } },
        }
      }),
      db.transaction.create({
        data: {
          id: uuidv4(),
          type: 'MINT',
          amount: MINT_FEE,
          userId: user.userId,
          nftId: undefined, // fee is for minting; link not required
          transactionHash: txHash,
        }
      })
    ]);

    const newBalance = availableBalance - MINT_FEE;

    return NextResponse.json({
      success: true,
      message: 'NFT created successfully',
      nft,
      mintFee: MINT_FEE,
      transaction: { id: mintTx.id, transactionHash: txHash },
      newBalance,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create NFT error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}