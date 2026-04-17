import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveBillingEligibilityForUser } from '@/lib/billing-eligibility';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const eligibility = await resolveBillingEligibilityForUser({ supabase, user });
  return NextResponse.json({ eligibility });
}
