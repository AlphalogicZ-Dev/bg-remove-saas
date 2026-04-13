-- ============================================================
-- ClearCut — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- Project: Settings → SQL Editor → New query → Paste → Run
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Images table
-- ─────────────────────────────────────────
create table if not exists public.images (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references auth.users(id) on delete cascade,
  original_path  text not null,
  processed_path text,
  file_name      text not null,
  file_size      integer,
  status         text default 'done'
                 check (status in ('pending', 'processing', 'done', 'error')),
  created_at     timestamptz default now() not null
);

-- Index for fast user lookups
create index if not exists images_user_id_idx on public.images(user_id);
create index if not exists images_created_at_idx on public.images(created_at desc);

-- Enable Row Level Security
alter table public.images enable row level security;

-- Users can only read/write their own rows
create policy "Users can select own images"
  on public.images for select
  using (auth.uid() = user_id);

create policy "Users can insert own images"
  on public.images for insert
  with check (auth.uid() = user_id);

create policy "Users can update own images"
  on public.images for update
  using (auth.uid() = user_id);

create policy "Users can delete own images"
  on public.images for delete
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────
-- 2. Storage buckets
-- ─────────────────────────────────────────

-- Original uploaded images (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'originals',
  'originals',
  false,
  20971520,  -- 20MB
  array['image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Processed (background-removed) images (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'processed',
  'processed',
  false,
  20971520,  -- 20MB
  array['image/png']
)
on conflict (id) do nothing;


-- ─────────────────────────────────────────
-- 3. Storage RLS policies
-- ─────────────────────────────────────────

-- ORIGINALS bucket
create policy "Users upload their own originals"
  on storage.objects for insert
  with check (
    bucket_id = 'originals'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read their own originals"
  on storage.objects for select
  using (
    bucket_id = 'originals'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete their own originals"
  on storage.objects for delete
  using (
    bucket_id = 'originals'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- PROCESSED bucket
create policy "Users upload their own processed"
  on storage.objects for insert
  with check (
    bucket_id = 'processed'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read their own processed"
  on storage.objects for select
  using (
    bucket_id = 'processed'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete their own processed"
  on storage.objects for delete
  using (
    bucket_id = 'processed'
    and auth.uid()::text = (storage.foldername(name))[1]
  );


-- ─────────────────────────────────────────
-- 4. Optional: cleanup function
-- Deletes processed images older than 30 days for storage management
-- Schedule with pg_cron or a Supabase Edge Function cron
-- ─────────────────────────────────────────
create or replace function public.cleanup_old_images()
returns void
language plpgsql
security definer
as $$
begin
  -- Log images marked for deletion
  raise notice 'Cleanup: removing images older than 30 days';

  -- Delete records (storage objects must be deleted separately via API)
  delete from public.images
  where created_at < now() - interval '30 days'
    and status = 'done';
end;
$$;
