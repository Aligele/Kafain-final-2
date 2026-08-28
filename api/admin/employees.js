import { supabase, readBody } from "../../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { name, role } = await readBody(req);
    if (!name) return res.status(400).json({ error: "name is required" });
    const { error } = await supabase.from("employees").insert({ name, role: role || "waiter" });
    if (error) throw error;
    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
