-- Lembretes pré/pós-atendimento.
-- offset_minutes: negativo = antes de starts_at; positivo = depois de ends_at.
-- Mantém offset_days (usado por recurrence_since_last_appointment).
ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS offset_minutes INTEGER;

-- Linka queue entry ao appointment específico (pro sync quando reagenda/cancela).
ALTER TABLE scheduled_message_queue
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE;

-- Evita duplicata de reminder pro mesmo (appointment, message).
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_appointment_message
  ON scheduled_message_queue(appointment_id, scheduled_message_id)
  WHERE appointment_id IS NOT NULL;
