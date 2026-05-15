-- =============================================================================
-- Optional hard cap: max 10 subscription rows per user (matches backend default).
-- Apply in Supabase SQL Editor or CLI after aligning with MAX_SUBSCRIPTIONS_PER_USER.
-- Change both the literal 10 below and backend env if you need a different cap.
-- =============================================================================

CREATE OR REPLACE FUNCTION makex_enforce_subscription_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT COUNT(*)::int FROM public.subscriptions WHERE user_id = NEW.user_id
  ) >= 10 THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LIMIT: Maximum subscriptions per user (10) reached';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS makex_subscription_limit_bi ON public.subscriptions;

CREATE TRIGGER makex_subscription_limit_bi
  BEFORE INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION makex_enforce_subscription_limit();
