How the reservation system works — plain explanation

## Building blocks

**Service** — something the vet offers (e.g. "Vakcinacija — 20 min / 2500 RSD"). Each service has:
- Trajanje (duration of the actual work)
- Cena
- Aktivna / neaktivna

**Clinic settings**
- Radno vreme — per weekday (e.g. "Ponedeljak 09:00–17:00, Nedelja zatvoreno").
- Pauza između termina — one global value per clinic. Dropdown: 0 / 5 / 10 / 15 minuta. Default 10. Applies after every appointment, regardless of service.

**Appointment** — one booking. Belongs to one clinic, one pet, one owner, one service, at one start time.

## The slot grid

The day is sliced into 15-minute cells: 09:00 · 09:15 · 09:30 · 09:45 · 10:00 ...

A slot is "free" when:
1. The service fits entirely inside the working day, AND
2. `start + duration + clinic.buffer_minutes` does not overlap any existing confirmed appointment's window.

That's it. No service-level snap rules, no per-service buffers.

## How the buffer works

The clinic's global buffer is glued to the end of every appointment.

Example — clinic buffer = 10 min, "Vakcinacija" = 20 min, booked at 09:00:
- 09:00 → 09:20 actual work
- 09:20 → 09:30 buffer
- Next free start = 09:30

Buffer is one-directional (added after, not before). Changing the buffer in clinic settings:
- recalculates all **future** confirmed appointments immediately (their `ends_at` is restamped via a trigger on `clinics.buffer_minutes`), so the vet's schedule packs or loosens in real time, and
- never touches **past** appointments — history stays frozen.
- If raising the buffer would cause two future appointments to overlap, the `appointments_no_overlap` EXCLUDE constraint rejects the whole buffer change atomically. The vet sees a clear error and must move or cancel the conflicting termin first.

## What the owner sees vs. the vet sees

**Owner** (Klijent → Zakažite termin):
- Choose pet → choose service → pick date → pick from a chronological list of free slots.
- Cannot book within the next 15 minutes.
- Cannot book past slots.
- Only sees services the vet has marked active.

**Vet** (Dashboard → Novo zakazivanje):
- Search owner or pet → pick service → pick date → same chronological list of free slots.
- No 15-min lead-time guard — vet can book a walk-in for "right now."

Same list, same engine. No packing recommendations, no gap warnings in MVP. If a vet ends up with gaps in the schedule, that's fine — fixing it is a V2 problem.

## Safety net (DB-level)

A Postgres exclusion constraint on `(clinic_id, time_range)` for `status = 'confirmed'` rows guarantees no two confirmed appointments overlap in one clinic. If two people press "Potvrdi termin" at the same millisecond, the loser gets a clean Serbian message — "Taj termin je upravo rezervisan. Molimo odaberite drugi." — and the slot list refreshes.

This means:
- No double-booking, ever.
- No "pending" state — every confirmed booking is truly confirmed.
- Cancelling (`status = 'cancelled'`) frees the slot instantly.

## Timezone

All slot math is anchored to **Europe/Belgrade** wall-clock time, regardless of the user's device clock. 09:00 in the app is 09:00 in Novi Sad, summer and winter.

## Schema (MVP)

```
services(id, clinic_id, name, duration_minutes, price, is_active)
clinics(... , buffer_minutes int default 10, ...)
appointments(id, clinic_id, pet_id, owner_id, service_id, starts_at, ends_at, status)
```

`ends_at = starts_at + duration_minutes + clinic.buffer_minutes` at insert time.

## Summary in one line

A vet defines services with durations; the clinic has one global buffer between appointments; the DB guarantees no two confirmed appointments overlap; both owner and vet see the same chronological list of free 15-minute slots.

## Out of scope for MVP (deferred to V2)

- Per-service buffers
- Packing-optimization hints ("Preporučeno" / gap warnings)
- 30-min snap for long services
- Booking-time snapshot of duration/buffer per appointment (DB trigger)
- Smart scheduling / utilization analytics
