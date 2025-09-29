import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// GET /api/materials-by-category?level=1|2|3&categoryName=...
// Returns: [{ specification: string }, ...]
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get('level');
  const categoryName = searchParams.get('categoryName');

  if (!level || !categoryName) {
    return NextResponse.json({ error: 'Missing level or categoryName' }, { status: 400 });
  }

  // Map numeric level to RPC filters
  const filters: Record<string, string> = {};
  if (level === '1') filters.major = categoryName;
  else if (level === '2') filters.middle = categoryName;
  else if (level === '3') filters.sub = categoryName;
  else {
    return NextResponse.json({ error: 'Invalid level. Use 1|2|3' }, { status: 400 });
  }

  try {
    // Use RPC to fetch distinct specifications under the given filters
    const { data, error } = await supabase.rpc('get_distinct_categories', {
      p_level: 'specification',
      p_filters: filters,
    });

    if (error) {
      console.error('Supabase RPC error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalize to array of { specification } objects
    const specs = Array.isArray(data)
      ? data
          .map((item: any) => {
            if (typeof item === 'string') return { specification: item };
            if (item && typeof item.specification === 'string') return { specification: item.specification };
            if (item && typeof item.category === 'string') return { specification: item.category };
            return null;
          })
          .filter(Boolean)
      : [];

    return NextResponse.json(specs);
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}