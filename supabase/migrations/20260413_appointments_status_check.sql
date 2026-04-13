alter table appointments
  add constraint appointments_status_check
  check (status in ('confirmed', 'cancelled', 'no_show'));
