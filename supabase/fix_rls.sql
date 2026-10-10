-- Permitir acceso a clientes tanto a usuarios autenticados como anónimos (para el MVP y Server Components con anon key)
drop policy if exists "Authenticated access to clients" on clients;
drop policy if exists "Public access to clients" on clients;
create policy "Public access to clients" on clients for all using (true) with check (true);

drop policy if exists "Authenticated access to pipelines" on pipelines;
drop policy if exists "Public access to pipelines" on pipelines;
create policy "Public access to pipelines" on pipelines for all using (true) with check (true);

drop policy if exists "Authenticated access to stages" on stages;
drop policy if exists "Public access to stages" on stages;
create policy "Public access to stages" on stages for all using (true) with check (true);

drop policy if exists "Authenticated access to contacts" on contacts;
drop policy if exists "Public access to contacts" on contacts;
create policy "Public access to contacts" on contacts for all using (true) with check (true);

drop policy if exists "Authenticated access to deals" on deals;
drop policy if exists "Public access to deals" on deals;
create policy "Public access to deals" on deals for all using (true) with check (true);

drop policy if exists "Authenticated access to forms" on forms;
drop policy if exists "Public access to forms" on forms;
create policy "Public access to forms" on forms for all using (true) with check (true);

drop policy if exists "Authenticated access to tracking_sites" on tracking_sites;
drop policy if exists "Public access to tracking_sites" on tracking_sites;
create policy "Public access to tracking_sites" on tracking_sites for all using (true) with check (true);

drop policy if exists "Authenticated access to tracking_events" on tracking_events;
drop policy if exists "Public access to tracking_events" on tracking_events;
create policy "Public access to tracking_events" on tracking_events for all using (true) with check (true);
