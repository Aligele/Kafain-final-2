import { supabase } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, name, category, price, stock_grams, grams_per_unit")
      .eq("active", true)
      .order("category").order("name");
    if (error) throw error;
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
