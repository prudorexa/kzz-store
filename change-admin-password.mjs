import { createClient } from "@supabase/supabase-js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_USER_ID,
  NEW_ADMIN_PASSWORD,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_USER_ID || !NEW_ADMIN_PASSWORD) {
  throw new Error("Missing required values in .env.admin");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error } = await supabase.auth.admin.updateUserById(ADMIN_USER_ID, {
  password: NEW_ADMIN_PASSWORD,
});

if (error) throw error;
console.log("Admin password changed.");