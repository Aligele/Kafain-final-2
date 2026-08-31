import { requireAdmin, supabase, readBody } from "../lib/db.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") {
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
    }

    if (req.method === "POST") {
      const { order_id, payment_method } = await readBody(req);
      if (!order_id) return res.status(400).json({ error: "order_id is required" });
      if (!payment_method || !["cash", "mpesa"].includes(payment_method)) {
        return res.status(400).json({ error: "payment_method must be 'cash' or 'mpesa'." });
      }

      const { data: existing } = await supabase.from("orders").select("status").eq("id", order_id).single();
      if (!existing) return res.status(404).json({ error: "Order not found." });
      if (existing.status !== "pending") return res.status(409).json({ error: `Order is already ${existing.status}.` });

      const { data: updated, error } = await supabase
        .from("orders")
        .update({ status: "completed", payment_method })
        .eq("id", order_id)
        .select("*")
        .single();
      if (error) throw error;

      return res.status(200).json(updated);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
