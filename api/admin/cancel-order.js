import { requireAdmin, supabase, readBody } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const { order_id } = await readBody(req);
    if (!order_id) return res.status(400).json({ error: "order_id is required" });

    const { data: order } = await supabase.from("orders").select("status").eq("id", order_id).single();
    if (!order) return res.status(404).json({ error: "Order not found." });
    if (order.status === "cancelled") return res.status(409).json({ error: "Order is already cancelled." });
    if (order.status === "completed") return res.status(409).json({ error: "Order is already paid and completed — cannot cancel." });

    const { data: items } = await supabase
      .from("order_items").select("product_id, quantity").eq("order_id", order_id);

    for (const item of items || []) {
      const { data: p } = await supabase.from("products").select("stock_grams, grams_per_unit").eq("id", item.product_id).single();
      if (p) {
        const restoreGrams = (p.grams_per_unit || 0) * item.quantity;
        await supabase.from("products").update({ stock_grams: Number(p.stock_grams) + restoreGrams }).eq("id", item.product_id);
      }
    }

    const { data: updated, error } = await supabase
      .from("orders").update({ status: "cancelled" }).eq("id", order_id).select("*").single();
    if (error) throw error;

    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
