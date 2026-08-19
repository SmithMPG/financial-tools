// Supabase client — imported by every page that needs DB access
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL  = "https://ahhvhnjctsgrnzobeovj.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoaHZobmpjdHNncm56b2Jlb3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MjYxNDEsImV4cCI6MjA5NzAwMjE0MX0.QACAmDQBexMv48UQw-YI5EGSnfQR_C5K3Gu6vkyKkyQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
