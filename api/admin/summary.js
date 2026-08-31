import { requireAdmin, supabase, todayDate } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const date = req.query.date || todayDate();
    const start = date + "T00:00:00", end = date + "T23:59:59.999";

    const { data: dayOrders, error } = await supabase
      .from("orders").select("id, subtotal, tax, total, channel, employee_id")
      .eq("status", "completed").gte("created_at", start).lt("created_at", end);
    if (error) throw error;

    const totals = dayOrders.reduce((acc, o) => ({
      orders_count: acc.orders_count + 1, subtotal: acc.subtotal + Number(o.subtotal),
      tax: acc.tax + Number(o.tax), total: acc.total + Number(o.total),
    }), { orders_count: 0, subtotal: 0, tax: 0, total: 0 });

    const { data: employees } = await supabase.from("employees").select("id, name");
    const empMap = Object.fromEntries((employees || []).map((e) => [e.id, e.name]));
    const byEmpAgg = {};
    for (const o of dayOrders) {
      const name = empMap[o.employee_id] || "Unassigned";
      if (!byEmpAgg[name]) byEmpAgg[name] = { employee_name: name, orders_count: 0, total: 0 };
      byEmpAgg[name].orders_count += 1;
      byEmpAgg[name].total += Number(o.total);
    }
    const by_employee = Object.values(byEmpAgg).sort((a, b) => b.total - a.total);

    const byChanAgg = {};
    for (const o of dayOrders) {
      if (!byChanAgg[o.channel]) byChanAgg[o.channel] = { channel: o.channel, orders_count: 0, total: 0 };
      byChanAgg[o.channel].orders_count += 1;
      byChanAgg[o.channel].total += Number(o.total);
    }
    const by_channel = Object.values(byChanAgg);

    const { data: closed } = await supabase.from("day_closes").select("*").eq("business_date", date).maybeSingle();

    return res.status(200).json({ date, ...totals, by_employee, by_channel, closed: closed || null });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
