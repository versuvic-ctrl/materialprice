import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    error: 'GET method not supported. Use POST with materials, startDate, endDate, and interval in request body.' 
  }, { status: 405 });
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );
    
    const { materials, startDate, endDate, interval } = await req.json();

    if (!materials || materials.length === 0) {
      return NextResponse.json({ error: 'Materials are required' }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }
    if (!interval) {
      return NextResponse.json({ error: 'Interval is required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('get_material_prices', {
      material_names: materials,
      start_date_str: startDate,
      end_date_str: endDate,
      time_interval: interval,
    });

    if (error) {
      console.error('Error fetching material prices:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error in POST /api/materials/prices:', error);
    // @ts-expect-error - error.message may not exist on unknown error type
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}