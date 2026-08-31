-- Personal + jornada: permite los tres perfiles que usa la aplicación.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin','supervisor','operator'));

-- Evita dos jornadas para la misma persona en el mismo día.
create unique index if not exists uq_workdays_operator_date on workdays(operator_id, work_date);
