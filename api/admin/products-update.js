import { requireAdmin, supabase, readBody } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;
  try {
    const { id, price, active, add_stock_grams } = await readBody(req);
    if (!id) return res.status(400).json({ error: "id is required" });

    if (price != null) await supabase.from("products").update({ price }).eq("id", id);
    if (active != null) await supabase.from("products").update({ active: !!active }).eq("id", id);
    if (add_stock_grams) {
      const { data: p } = await supabase.from("products").select("stock_grams").eq("id", id).single();
      await supabase.from("products").update({ stock_grams: Number(p.stock_grams) + Number(add_stock_grams) }).eq("id", id);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
