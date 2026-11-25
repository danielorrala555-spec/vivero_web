// Completar únicamente después de crear el proyecto independiente del vivero.
// Nunca copiar aquí la URL ni la clave del proyecto Akita Elite.
const VIVERO_SUPABASE_URL = "https://rfmwdwroxphxngmjgqdo.supabase.co";
const VIVERO_SUPABASE_ANON_KEY = "sb_publishable_QWMa8l5CheQUs9JbFqIBdA_n3l4W9Mp";
const MODO_DEMO = !VIVERO_SUPABASE_URL || !VIVERO_SUPABASE_ANON_KEY;
const supabaseClient = MODO_DEMO ? null : window.supabase.createClient(VIVERO_SUPABASE_URL, VIVERO_SUPABASE_ANON_KEY);
