import { requireAdmin, supabase, todayDate, readBody } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const body = await readBody(req);
    const date = body.business_date || todayDate();
    const closedBy = body.closed_by || "admin";

    const { data: existing } = await supabase.from("day_closes").select("*").eq("business_date", date).maybeSingle();
    if (existing) return res.status(409).json({ error: `${date} is already closed.`, close: existing });

    const start = date + "T00:00:00", end = date + "T23:59:59.999";
    const { data: dayOrders } = await supabase
      .from("orders").select("subtotal, tax, total").eq("status", "completed").gte("created_at", start).lt("created_at", end);
    const totals = (dayOrders || []).reduce((acc, o) => ({
      orders_count: acc.orders_count + 1, subtotal: acc.subtotal + Number(o.subtotal),
      tax: acc.tax + Number(o.tax), total: acc.total + Number(o.total),
    }), { orders_count: 0, subtotal: 0, tax: 0, total: 0 });

    const { data: result, error } = await supabase.from("day_closes").insert({
      business_date: date, orders_count: totals.orders_count, subtotal: totals.subtotal,
      tax: totals.tax, total: totals.total, closed_by: closedBy,
    }).select("*").single();
    if (error) throw error;
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
