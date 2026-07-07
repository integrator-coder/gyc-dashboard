import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: any = {
      tenantId: 'gyc'
    };

    if (category) {
      where.category = category;
    }

    const companies = await prisma.aIWatchCompany.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    return NextResponse.json({
      success: true,
      data: companies,
      count: companies.length
    });
  } catch (error: any) {
    console.error('WatchBoard Companies API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
