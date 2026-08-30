import { requireAdmin, supabase } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, daily_number, subtotal, tax, total, channel, payment_method, employee_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;

    if (!orders || orders.length === 0) return res.status(200).json([]);

    const { data: employees } = await supabase.from("employees").select("id, name");
    const empMap = Object.fromEntries((employees || []).map((e) => [e.id, e.name]));

    const orderIds = orders.map((o) => o.id);
    const { data: items } = await supabase
      .from("order_items")
      .select("order_id, quantity, unit_price, product_id")
      .in("order_id", orderIds);

    const productIds = [...new Set((items || []).map((i) => i.product_id))];
    const { data: products } = await supabase.from("products").select("id, name").in("id", productIds);
    const productMap = Object.fromEntries((products || []).map((p) => [p.id, p.name]));

    const itemsByOrder = {};
    for (const it of items || []) {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push({
        name: productMap[it.product_id] || "Item",
        quantity: it.quantity,
        line_total: it.unit_price * it.quantity,
      });
    }

    const result = orders.map((o) => ({
      ...o,
      employee_name: empMap[o.employee_id] || "Unassigned",
      items: itemsByOrder[o.id] || [],
    }));

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
