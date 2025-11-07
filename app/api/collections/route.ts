import { NextRequest, NextResponse } from 'next/server';
import { db, getPaginationData, generateUniqueSlug } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { collectionQuerySchema, collectionCreateSchema, collectionUpdateSchema } from '@/lib/validations';
import { v4 as uuidv4 } from 'uuid';

// GET /api/collections - List collections with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    
    // Convert string numbers to actual numbers for validation
    const queryParams = {
      ...rawParams,
      ...(rawParams.page && { page: parseInt(rawParams.page) }),
      ...(rawParams.limit && { limit: parseInt(rawParams.limit) }),
    };

    // Validate query parameters
    const validation = collectionQuerySchema.safeParse(queryParams);
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
      query,
      creatorId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validation.data;

    // Build where clause
    const where: any = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { creator: { username: { contains: query, mode: 'insensitive' } } },
      ];
    }

    if (creatorId) {
      where.creatorId = creatorId;
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'updatedAt') {
      orderBy.updatedAt = sortOrder;
    }

    // Get total count for pagination
    const totalCount = await db.collection.count({ where });

    // Get collections with pagination
    const collections = await db.collection.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        _count: {
          select: {
            nfts: true,
          }
        }
      }
    });

    // Calculate additional statistics for each collection
    const collectionsWithStats = await Promise.all(
      collections.map(async (collection) => {
        const stats = await db.nFT.aggregate({
          where: { collectionId: collection.id },
          _sum: { price: true },
          _min: { price: true },
          _max: { price: true },
          _avg: { price: true },
        });

        const { _count, ...collectionData } = collection;

        return {
          ...collectionData,
          stats: {
            totalNFTs: _count.nfts,
            totalVolume: stats._sum.price || 0,
            floorPrice: stats._min.price || 0,
            ceilingPrice: stats._max.price || 0,
            averagePrice: stats._avg.price || 0,
          }
        };
      })
    );

    // Get pagination data
    const pagination = getPaginationData(page, limit, totalCount);

    return NextResponse.json({
      success: true,
      collections: collectionsWithStats,
      pagination,
    });

  } catch (error: any) {
    console.error('Get collections error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/collections - Create new collection
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
    const validation = collectionCreateSchema.safeParse(body);
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
    } = validation.data;

    // Generate unique slug
    const slug = await generateUniqueSlug(name);

    // Create collection
    const collection = await db.collection.create({
      data: {
        id: uuidv4(),
        name,
        description,
        image,
        slug,
        creatorId: user.userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isVerified: true,
          }
        },
        _count: {
          select: {
            nfts: true,
          }
        }
      }
    });

    // Add initial stats
    const { _count, ...collectionData } = collection;
    const collectionWithStats = {
      ...collectionData,
      stats: {
        totalNFTs: 0,
        totalVolume: 0,
        floorPrice: 0,
        ceilingPrice: 0,
        averagePrice: 0,
      }
    };

    return NextResponse.json({
      success: true,
      message: 'Collection created successfully',
      collection: collectionWithStats,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Create collection error:', error);
    
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}