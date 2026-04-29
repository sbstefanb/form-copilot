import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Save = z.object({
  id: z.string().uuid(),
  payload: z.record(z.string(), z.any()),
});

export const saveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Save.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("failure_reports")
      .update({ ...data.payload, user_id: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
