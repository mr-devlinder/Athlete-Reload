-- The public wrapper is a security-invoker function and delegates to this
-- ownership-validating base function. Signed-in callers therefore need
-- execute permission on both functions for the atomic check-in write.
grant execute on function public.save_checkin_with_pain_reports_base(jsonb, jsonb, uuid) to authenticated;

revoke execute on function public.save_checkin_with_pain_reports_base(jsonb, jsonb, uuid) from anon, public;
