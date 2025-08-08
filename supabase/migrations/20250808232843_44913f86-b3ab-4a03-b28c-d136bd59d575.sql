-- Create table for external database connections
create table if not exists public.external_databases (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  name text not null,
  type text not null,
  api_key text,
  upload_endpoint text,
  status text not null default 'connected',
  last_sync_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.external_databases enable row level security;

-- Policies
create policy "Users can view databases in their firm"
  on public.external_databases for select
  using (firm_id = get_user_firm_id());

create policy "Users can create databases in their firm"
  on public.external_databases for insert
  with check (firm_id = get_user_firm_id() and created_by = auth.uid());

create policy "Users can update their own databases"
  on public.external_databases for update
  using (created_by = auth.uid());

create policy "Admins can update all firm databases"
  on public.external_databases for update
  using (is_admin() and firm_id = get_user_firm_id());

-- Trigger to update updated_at
drop trigger if exists update_external_databases_updated_at on public.external_databases;
create trigger update_external_databases_updated_at
before update on public.external_databases
for each row execute function public.update_updated_at_column();

-- Create private storage bucket for database uploads
insert into storage.buckets (id, name, public)
values ('database-uploads', 'database-uploads', false)
on conflict (id) do nothing;

-- Storage policies for the bucket
drop policy if exists "Users can read their own uploads" on storage.objects;
create policy "Users can read their own uploads"
  on storage.objects for select to authenticated
  using (bucket_id = 'database-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can upload to their own folder" on storage.objects;
create policy "Users can upload to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'database-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own uploads" on storage.objects;
create policy "Users can update their own uploads"
  on storage.objects for update to authenticated
  using (bucket_id = 'database-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete their own uploads" on storage.objects;
create policy "Users can delete their own uploads"
  on storage.objects for delete to authenticated
  using (bucket_id = 'database-uploads' and auth.uid()::text = (storage.foldername(name))[1]);