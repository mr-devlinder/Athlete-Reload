drop policy if exists "AI request windows are RPC-only" on public.ai_request_windows;
create policy "AI request windows are RPC-only"
on public.ai_request_windows as restrictive for all to authenticated
using (false) with check (false);
