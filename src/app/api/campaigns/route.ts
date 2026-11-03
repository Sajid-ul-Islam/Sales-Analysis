import { NextRequest, NextResponse } from 'next/server';
import { validateApiRequest } from '@/lib/auth/apiAuth';
import { INITIAL_WINTER_CAMPAIGNS } from '@/lib/campaignStore';
import { Campaign } from '@/types/campaign';

// In-memory server-side fallback store for active sessions
let inMemoryCampaigns: Campaign[] = [...INITIAL_WINTER_CAMPAIGNS];

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = validateApiRequest(req, { requiredRole: 'readonly', allowDemo: true });
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const objective = searchParams.get('objective');

    let result = inMemoryCampaigns;
    if (status) {
      result = result.filter((c) => c.status.toLowerCase() === status.toLowerCase());
    }
    if (objective) {
      result = result.filter((c) => c.objective.toLowerCase() === objective.toLowerCase());
    }

    return NextResponse.json({
      success: true,
      campaigns: result,
      totalCount: result.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: true });
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized to save campaign' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.campaign) {
      return NextResponse.json({ error: 'Campaign payload required' }, { status: 400 });
    }

    const campaign: Campaign = {
      ...body.campaign,
      updatedAt: new Date().toISOString(),
    };

    const idx = inMemoryCampaigns.findIndex((c) => c.id === campaign.id);
    if (idx >= 0) {
      inMemoryCampaigns[idx] = campaign;
    } else {
      inMemoryCampaigns = [campaign, ...inMemoryCampaigns];
    }

    return NextResponse.json({
      success: true,
      campaign,
      campaigns: inMemoryCampaigns,
      message: 'Campaign saved successfully',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = validateApiRequest(req, { requiredRole: 'operator', allowDemo: true });
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    inMemoryCampaigns = inMemoryCampaigns.filter((c) => c.id !== id);

    return NextResponse.json({
      success: true,
      deletedId: id,
      campaigns: inMemoryCampaigns,
      message: 'Campaign deleted successfully',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
