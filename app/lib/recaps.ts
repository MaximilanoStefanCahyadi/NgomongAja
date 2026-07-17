import { supabase } from './supabase';

export type RecapPeriod = 'today' | 'week' | 'month';

export type Recap = {
  orderCount: number;
  revenuePaid: number; // completed AND paid — money actually in hand
  revenueUnpaid: number; // completed but NOT paid — goods gone, money owed
  topItems: { name: string; totalQty: number }[];
};

function periodStart(period: RecapPeriod): Date {
  const now = new Date();
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - 6);
    return d;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Last-7-days PAID revenue per day, oldest first — feeds the recap bar chart.
export type DailyRevenue = { label: string; total: number; isToday: boolean };

export async function fetchDailyRevenue(storeId: string): Promise<DailyRevenue[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - 6);

  const { data, error } = await supabase
    .from('orders')
    .select('total, created_at, payments(status)')
    .eq('store_id', storeId)
    .eq('status', 'completed')
    .gte('created_at', start.toISOString());
  if (error) throw error;

  const days: DailyRevenue[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({
      label: d.toLocaleDateString('id-ID', { weekday: 'short' }),
      total: 0,
      isToday: i === 6,
    });
  }
  for (const o of data as any[]) {
    if (o.payments?.[0]?.status !== 'paid') continue; // chart shows money in hand
    const idx = Math.floor(
      (new Date(o.created_at).getTime() - start.getTime()) / 86400000
    );
    if (idx >= 0 && idx < 7) days[idx].total += o.total;
  }
  return days;
}

// Recaps are honest (PRD S-1/S-3): paid and unpaid revenue are separated so
// the number on screen can be reconciled with the cash drawer.
export async function fetchRecap(storeId: string, period: RecapPeriod): Promise<Recap> {
  const since = periodStart(period).toISOString();

  const { data, error } = await supabase
    .from('orders')
    .select('id, total, payments(status), order_items(quantity, products(name))')
    .eq('store_id', storeId)
    .eq('status', 'completed')
    .gte('created_at', since);
  if (error) throw error;

  let revenuePaid = 0;
  let revenueUnpaid = 0;
  const qtyByName = new Map<string, number>();

  for (const o of data as any[]) {
    const paid = o.payments?.[0]?.status === 'paid';
    if (paid) revenuePaid += o.total;
    else revenueUnpaid += o.total;
    for (const item of o.order_items ?? []) {
      const name = item.products?.name ?? '?';
      qtyByName.set(name, (qtyByName.get(name) ?? 0) + Number(item.quantity));
    }
  }

  const topItems = [...qtyByName.entries()]
    .map(([name, totalQty]) => ({ name, totalQty }))
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, 5);

  return { orderCount: (data as any[]).length, revenuePaid, revenueUnpaid, topItems };
}
