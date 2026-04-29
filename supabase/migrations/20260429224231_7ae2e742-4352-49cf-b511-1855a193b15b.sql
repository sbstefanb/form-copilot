
-- Fix set_updated_at search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Enable RLS on counters (no policies = no direct access; trigger uses SECURITY DEFINER)
ALTER TABLE public.report_counters ENABLE ROW LEVEL SECURITY;

-- Revoke EXECUTE on SECURITY DEFINER trigger functions from PUBLIC/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_evidencioni_broj() FROM PUBLIC, anon, authenticated;
