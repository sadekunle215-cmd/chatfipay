import { NextRequest, NextResponse } from 'next/server';

const PEYFLEX_BASE  = 'https://client.peyflex.com.ng';
const PEYFLEX_TOKEN = process.env.PEYFLEX_TOKEN || '';

async function pfGet(path: string) {
  const res = await fetch(`${PEYFLEX_BASE}${path}`, {
    headers: { 'Authorization': `Token ${PEYFLEX_TOKEN}`, 'Content-Type': 'application/json' },
  });
  return res.json();
}

async function pfPost(path: string, body: any) {
  const res = await fetch(`${PEYFLEX_BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Token ${PEYFLEX_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// GET /api/bills?type=airtime-networks
// GET /api/bills?type=data-plans&network=MTN
// GET /api/bills?type=cable-plans&provider=DSTV
// GET /api/bills?type=electricity-verify&meter=123&plan=IKEDC&mtype=prepaid
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  try {
    if (type === 'airtime-networks') {
      const data = await pfGet('/api/airtime/networks/');
      return NextResponse.json({ success: true, networks: data.networks || [] });
    }
    if (type === 'data-plans') {
      const network = searchParams.get('network');
      if (!network) return NextResponse.json({ success: false, error: 'network required' }, { status: 400 });
      const data = await pfGet(`/api/data/plans/?network=${network}`);
      return NextResponse.json({ success: true, plans: data.plans || [] });
    }
    if (type === 'cable-plans') {
      const provider = searchParams.get('provider');
      if (!provider) return NextResponse.json({ success: false, error: 'provider required' }, { status: 400 });
      const data = await pfGet(`/api/cable/plans/${provider}/`);
      return NextResponse.json({ success: true, plans: data.plans || [] });
    }
    if (type === 'electricity-verify') {
      const meter = searchParams.get('meter');
      const plan  = searchParams.get('plan');
      const mtype = searchParams.get('mtype') || 'prepaid';
      if (!meter || !plan) return NextResponse.json({ success: false, error: 'meter and plan required' }, { status: 400 });
      const data = await pfGet(`/api/electricity/verify/?identifier=electricity&meter=${meter}&plan=${plan}&type=${mtype}`);
      return NextResponse.json({ success: true, data });
    }
    if (type === 'balance') {
      const data = await pfGet('/api/wallet/');
      return NextResponse.json({ success: true, balance: data.wallet_credit, data });
    }
    return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST /api/bills  body: { type, ...fields }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type } = body;

  try {
    if (type === 'airtime') {
      const { network, amount, mobile_number } = body;
      if (!network || !amount || !mobile_number)
        return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
      const data = await pfPost('/api/airtime/topup/', { network, amount, mobile_number });
      if (data.status === 'SUCCESS')
        return NextResponse.json({ success: true, message: 'Airtime sent!', data });
      return NextResponse.json({ success: false, error: data.message || 'Airtime failed', data }, { status: 400 });
    }

    if (type === 'data') {
      const { network, plan_code, mobile_number } = body;
      if (!network || !plan_code || !mobile_number)
        return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
      const data = await pfPost('/api/data/purchase/', { network, plan_code, mobile_number });
      if (data.status === 'SUCCESS')
        return NextResponse.json({ success: true, message: 'Data purchased!', data });
      return NextResponse.json({ success: false, error: data.message || 'Data failed', data }, { status: 400 });
    }

    if (type === 'cable-verify') {
      const { iuc, identifier } = body;
      if (!iuc || !identifier)
        return NextResponse.json({ success: false, error: 'iuc and identifier required' }, { status: 400 });
      const data = await pfPost('/api/cable/verify/', { iuc, identifier });
      return NextResponse.json({ success: true, data });
    }

    if (type === 'cable') {
      const { identifier, plan, iuc, phone, amount } = body;
      if (!identifier || !plan || !iuc)
        return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
      const data = await pfPost('/api/cable/subscribe/', { identifier, plan, iuc, phone, amount: String(amount) });
      if (data.status === 'SUCCESS')
        return NextResponse.json({ success: true, message: 'Cable subscription successful!', data });
      return NextResponse.json({ success: false, error: data.message || 'Cable failed', data }, { status: 400 });
    }

    if (type === 'electricity') {
      const { meter, plan, amount, mtype, phone } = body;
      if (!meter || !plan || !amount)
        return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 });
      const data = await pfPost('/api/electricity/subscribe/', {
        identifier: 'electricity', meter, plan, amount: String(amount), type: mtype || 'prepaid', phone,
      });
      if (data.status === 'SUCCESS')
        return NextResponse.json({ success: true, message: 'Electricity recharge successful!', token: data.token || '', data });
      return NextResponse.json({ success: false, error: data.message || 'Electricity failed', data }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
