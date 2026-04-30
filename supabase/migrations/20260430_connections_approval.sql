-- Add approval status to connections
ALTER TABLE connections
  ADD COLUMN status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed'));

-- Confirm all existing connections so the change is non-breaking
UPDATE connections SET status = 'confirmed';

-- Owner may only INSERT rows where status = 'pending'
DROP POLICY IF EXISTS "owner connects" ON connections;
CREATE POLICY "owner connects" ON connections
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND status = 'pending');

-- Vet may UPDATE (approve) connections for their clinic
CREATE POLICY "vet approves connections" ON connections
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.clinic_id = connections.clinic_id
        AND p.role = 'vet'
    )
  )
  WITH CHECK (
    status = 'confirmed'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.clinic_id = connections.clinic_id
        AND p.role = 'vet'
    )
  );

-- Gate vet pet access on confirmed connections only
DROP POLICY IF EXISTS "vet manages connected pets" ON pets;
CREATE POLICY "vet manages connected pets" ON pets
  USING (
    EXISTS (
      SELECT 1 FROM connections c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.owner_id = pets.owner_id
        AND c.clinic_id = p.clinic_id
        AND p.role = 'vet'
        AND c.status = 'confirmed'
    )
  );

-- Gate vet day-notes access on confirmed connections only
DROP POLICY IF EXISTS "vet reads connected owner day notes" ON owner_day_notes;
CREATE POLICY "vet reads connected owner day notes" ON owner_day_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM connections c
      JOIN profiles p ON p.id = auth.uid()
      WHERE c.owner_id = owner_day_notes.owner_id
        AND c.clinic_id = p.clinic_id
        AND p.role = 'vet'
        AND c.status = 'confirmed'
    )
  );

-- Gate owner service visibility on confirmed connections only
DROP POLICY IF EXISTS "owner reads active services" ON services;
CREATE POLICY "owner reads active services" ON services
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM connections c
      WHERE c.owner_id = auth.uid()
        AND c.clinic_id = services.clinic_id
        AND c.status = 'confirmed'
    )
  );
