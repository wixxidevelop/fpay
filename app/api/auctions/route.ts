import { NextRequest, NextResponse } from 'next/server';
import { db, getPaginationData } from '@/lib/db';
import { requireAuth, validateNFTOwnership } from '@/lib/auth';
import { auctionQuerySchema, auctionCreateSchema } from '@/lib/validations';
import { v4 as uuidv4 } from 'uuid';

// GET /api/auctions - List auctions with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    
    // Convert string numbers to actual numbers for validation
    const queryParams: any = { ...rawParams };
    if (rawParams.page) queryParams.page = parseInt(rawParams.page);
    if (rawParams.limit) queryParams.limit = parseInt(rawParams.limit);
    if (rawParams.minPrice) queryParams.minPrice = parseFloat(rawParams.minPrice);
    if (rawParams.maxPrice) queryParams.maxPrice = parseFloat(rawParams.maxPrice);

    // Validate query parameters
    const validation = auctionQuerySchema.safeParse(queryParams);
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
      isActive,
      creatorId,
      category,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validation.data;

    // Build where clause
    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (creatorId) {
      where.sellerId = creatorId;
    }

    if (category) {
      where.nft = { category };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.startPrice = {};
      if (minPrice !== undefined) where.startPrice.gte = minPrice;
      if (maxPrice !== undefined) where.startPrice.lte = maxPrice;
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'startPrice') {
      orderBy.startPrice = sortOrder;
    } else if (sortBy === 'endTime') {
      orderBy.endTime = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    }

    // Get total count for pagination
    const totalCount = await db.auction.count({ where });

    // Get auctions with pagination
    const auctions = await db.auction.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        nft: {
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
            }
          }
        },
        bids: {
          orderBy: { amount: 'desc' },
          take: 1,
          include: {
            bidder: {
              select: {
                id: true,
                username: true,
                avatar: true,
              }
            }
          }
        },
        _count: {
          select: {
            bids: true,
          }
        }
      }
    });

    // Add current highest bid and time remaining to each auction
    const auctionsWithDetails = auctions.map(auction => {
      const { _count, bids, ...auctionData } = auction;
      const currentBid = bids[0] || null;
      const now = new Date();
      const timeRemaining = auction.endTime.getTime() - now.getTime();
      
      return {
        ...auctionData,
        currentBid,
        totalBids: _count.bids,
        timeRemaining: Math.max(0, timeRemaining),
        isExpired: timeRemaining <= 0,
      };
    });

    // Get pagination data
    const pagination = getPaginationData(page, limit, totalCount);

    return NextResponse.json({
      success: true,
      auctions: auctionsWithDetails,
      pagination,
    });

  } catch (error: any) {
    console.error('Get auctions error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/auctions - Create new auction
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
    const validation = auctionCreateSchema.safeParse(body);
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
      nftId,
      startingPrice,
      reservePrice,
      duration,
    } = validation.data;

    // Check if NFT exists and user owns it
    const nft = await db.nFT.findUnique({
      where: { id: nftId },
      select: { 
        id: true,
        ownerId: true, 
        isListed: true,
        isSold: true,
        name: true,
      }
    });

    if (!nft) {
      return NextResponse.json(
        { success: false, error: 'NFT not found' },
        { status: 404 }
      );
    }

    // Validate NFT ownership
    const hasPermission = await validateNFTOwnership(user.userId, nftId, user.isAdmin);
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to auction this NFT' },
        { status: 403 }
      );
    }

    // Check if NFT is available for auction
    if (nft.isSold) {
      return NextResponse.json(
        { success: false, error: 'NFT is already sold and not available for auction' },
        { status: 400 }
      );
    }

    // Check if there's already an active auction for this NFT
    const existingAuction = await db.auction.findFirst({
      where: {
        nftId,
        isActive: true,
        endTime: { gt: new Date() }
      }
    });

    if (existingAuction) {
      return NextResponse.json(
        { success: false, error: 'NFT already has an active auction' },
        { status: 400 }
      );
    }

    // Calculate end time
    const endTime = new Date(Date.now() + duration * 60 * 60 * 1000); // duration in hours

    // Create auction
    const auction = await db.auction.create({
      data: {
        id: uuidv4(),
        nftId,
        sellerId: user.userId,
        startPrice: startingPrice,
        currentPrice: startingPrice,
        reservePrice,
        startTime: new Date(),
        endTime,
        isActive: true,
      },
      include: {
        nft: {
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
            }
          }
        },
        _count: {
          select: {
            bids: true,
          }
        }
      }
    });

    // Add auction details
    const { _count, ...auctionData } = auction;
    const now = new Date();
    const timeRemaining = auction.endTime.getTime() - now.getTime();

    const auctionWithDetails = {
      ...auctionData,
      currentBid: null,
      totalBids: 0,
      timeRemaining: Math.max(0, timeRemaining),
      isExpired: false,
    };

    return NextResponse.json({
      success: true,
      message: 'Auction created successfully',
      auction: auctionWithDetails,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create auction error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}