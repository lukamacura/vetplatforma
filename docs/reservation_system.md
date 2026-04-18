How the reservation system works — plain explanation
The building blocks
Services — things the vet offers (e.g. "Vakcinacija — 20 min / 2500 RSD", "Operacija — 90 min / 15000 RSD"). Each service has:

Trajanje (how long the actual work takes)
Cena
Pauza posle (the buffer — cleaning/breathing time after this service ends)
Radno vreme (clinic hours) — per weekday, e.g. "Ponedeljak 09:00–17:00, Nedelja zatvoreno."

Appointment — one booking. It belongs to one clinic, one pet, one owner, one service, at one start time.

The slot grid
The app slices every working day into 15-minute cells:

09:00 · 09:15 · 09:30 · 09:45 · 10:00 · 10:15 · ...
(Services of 60+ min snap to 30-min boundaries — 09:00, 09:30, 10:00 — because starting a 1-hour op at 09:15 is just clumsy.)

A slot is "free" when the service fits entirely inside the working day AND doesn't bump into any existing appointment's time-window.

How buffers work (the key part)
Every appointment occupies more time than its service duration. The buffer is glued to the end:

Service "Vakcinacija" = 20 min + 5 min buffer
If an owner books 09:00:
    09:00 ────────────────── 09:20   ← actual work
           09:20 ──── 09:25            ← buffer (cleaning / notes)
    Total blocked time: 09:00 → 09:25
Next free start = 09:25 or later.
The buffer is one-directional — it's added after, not before. A new appointment can start the exact second the previous one's buffer ends.

Two different services, different buffers:

09:00  [Vakcinacija · 20m] [buf 5m]
       ──────────────────────── 09:25
09:30  [Operacija · 90m] [buf 15m]
       ──────────────────────── 11:15
11:15  next free slot
Gap between 09:25 and 09:30 is 5 min of real open space — visible on the vet's grid but not bookable (too short for the 15-min cell alignment).

How buffers are set, and when they change
Per service, in Dashboard → Usluge:

Vet creates "Vakcinacija" with duration 20 min. App suggests buffer 5 min (short service default).
Vet creates "Operacija" with duration 90 min. App suggests buffer 15 min (long service default).
Vet can override either — e.g. set Vakcinacija buffer to 0 or 10 min.
Suggested defaults (from suggestBuffer()):

≤ 15 min service → 0 min buffer
≤ 30 min → 5 min buffer
≤ 60 min → 10 min buffer
60 min → 15 min buffer

These are just pre-fills — the vet can write any value from 0 to 60.

Changing a buffer later (the important part):

Because of the DB trigger we added today, each appointment remembers the duration and buffer at the moment it was booked. If the vet later edits "Vakcinacija" buffer from 5 → 15 min:

Appointments already booked keep occupying their original 09:00 → 09:25 window. Nothing on their calendar moves.
Appointments booked from now on use the new 15-min buffer.
That's why the services page now says "Izmene važe samo za nove termine — već zakazani termini zadržavaju trajanje sa trenutka rezervacije." — it matches what the DB actually does.

No retroactive schedule chaos. A vet can experiment with buffer lengths without worrying about yesterday's calendar shifting.

What the owner sees vs. what the vet sees
Owner (Klijent → Zakažite termin):

Choose pet → choose service → pick date → pick one of all free slots, chronological.
Can't book within the next 15 minutes (avoids "in 2 min" scramble).
Can't book past slots.
Can't book services the vet hasn't marked active.
Vet (Dashboard → Novo zakazivanje):

Search owner or pet in one list → pick service → pick date → see all free slots, ranked:
Green ⭐ Preporučeno slots sit right up against existing appointments (dense packing).
Plain slots leave gaps; vet can still pick them, with a small amber warning "Ostavlja prazninu od X min u rasporedu."
No 15-min lead time guard — vet can book a walk-in for "right now."
Same underlying engine, different coats. Owner sees full menu with no noise. Vet sees full menu with optimization hints.

The safety net (the new DB rule)
Even if two people press "Potvrdi termin" at the same millisecond for the same slot, or the frontend has a bug, the database itself now refuses to store two confirmed appointments that overlap in one clinic. The loser gets a clean Serbian message — "Taj termin je upravo rezervisan. Molimo odaberite drugi." — and the slot list refreshes.

That means:

No double-booking, ever.
No "pending / waiting for vet approval" state — every confirmed booking is truly confirmed.
Cancelling an appointment (status = cancelled) frees the slot instantly.
Timezone — one sentence
All slot math is anchored to Europe/Belgrade wall-clock time regardless of the user's device clock. 09:00 in the app is 09:00 in Novi Sad, summer and winter.

When someone cancels
Set status = 'cancelled' on the appointment. The exclusion constraint only applies to status = 'confirmed' rows, so the time window becomes immediately bookable by someone else. No manual cleanup needed.

Summary in one line
A vet defines services with durations and end-buffers; appointments lock in those numbers at booking time; the DB guarantees no two overlap; the owner sees every truly free 15-minute slot, the vet sees the same list with packing recommendations on top.