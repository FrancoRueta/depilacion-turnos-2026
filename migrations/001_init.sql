-- Estructura inicial: administración, fechas de atención y reservas.

CREATE TABLE admins (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admins_username_length CHECK (char_length(username) BETWEEN 3 AND 64)
);

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT admin_sessions_expiry CHECK (expires_at > created_at)
);

CREATE INDEX admin_sessions_expires_idx ON admin_sessions (expires_at);

CREATE TABLE service_dates (
  id UUID PRIMARY KEY,
  date DATE NOT NULL,
  open_time TIME NOT NULL DEFAULT TIME '08:00',
  close_time TIME NOT NULL DEFAULT TIME '18:00',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_dates_date_unique UNIQUE (date),
  CONSTRAINT service_dates_window CHECK (
    open_time >= TIME '06:00'
    AND close_time <= TIME '22:00'
    AND open_time < close_time
  ),
  CONSTRAINT service_dates_half_hour CHECK (
    EXTRACT(MINUTE FROM open_time) IN (0, 30)
    AND EXTRACT(SECOND FROM open_time) = 0
    AND EXTRACT(MINUTE FROM close_time) IN (0, 30)
    AND EXTRACT(SECOND FROM close_time) = 0
  ),
  CONSTRAINT service_dates_weekend CHECK (
    EXTRACT(DOW FROM date)::integer IN (0, 5, 6)
  )
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  service_date_id UUID NOT NULL REFERENCES service_dates(id) ON DELETE RESTRICT,
  start_time TIME NOT NULL,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  zones TEXT[] NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bookings_slot_unique UNIQUE (service_date_id, start_time),
  CONSTRAINT bookings_age_positive CHECK (age > 0),
  CONSTRAINT bookings_full_name_length CHECK (char_length(full_name) BETWEEN 3 AND 120),
  CONSTRAINT bookings_phone_length CHECK (char_length(phone) BETWEEN 8 AND 30),
  CONSTRAINT bookings_zones_not_empty CHECK (cardinality(zones) > 0),
  CONSTRAINT bookings_start_half_hour CHECK (
    EXTRACT(MINUTE FROM start_time) IN (0, 30)
    AND EXTRACT(SECOND FROM start_time) = 0
  )
);

CREATE INDEX bookings_service_date_idx ON bookings (service_date_id);

-- Valida que cada turno pertenezca a una fecha activa, a su grilla de 30
-- minutos y que no esté en el pasado (hora de Buenos Aires).
CREATE OR REPLACE FUNCTION validate_booking_slot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_date date;
  v_open time;
  v_close time;
  v_active boolean;
  v_now timestamp;
BEGIN
  SELECT sd.date, sd.open_time, sd.close_time, sd.active
    INTO v_date, v_open, v_close, v_active
    FROM service_dates sd
   WHERE sd.id = NEW.service_date_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'service_date_not_found' USING ERRCODE = '23503';
  END IF;

  IF NOT v_active THEN
    RAISE EXCEPTION 'service_date_inactive' USING ERRCODE = '23514';
  END IF;

  IF NEW.start_time < v_open OR NEW.start_time + interval '30 minutes' > v_close THEN
    RAISE EXCEPTION 'booking_outside_service_window' USING ERRCODE = '23514';
  END IF;

  v_now := CURRENT_TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires';

  IF v_date < v_now::date THEN
    RAISE EXCEPTION 'service_date_past' USING ERRCODE = '23514';
  END IF;

  IF v_date = v_now::date AND v_now::time >= NEW.start_time THEN
    RAISE EXCEPTION 'booking_slot_past' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_validate_slot
BEFORE INSERT OR UPDATE OF service_date_id, start_time ON bookings
FOR EACH ROW EXECUTE FUNCTION validate_booking_slot();

-- Protege las reservas existentes ante cambios, desactivación o borrado de
-- una fecha de atención. Nunca se dejan turnos huérfanos.
CREATE OR REPLACE FUNCTION guard_service_date_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
  v_invalid integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT count(*) INTO v_count FROM bookings WHERE service_date_id = OLD.id;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'service_date_has_bookings' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.date <> OLD.date OR (OLD.active AND NOT NEW.active) THEN
    SELECT count(*) INTO v_count FROM bookings WHERE service_date_id = OLD.id;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'service_date_has_bookings' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT count(*) INTO v_invalid
    FROM bookings
   WHERE service_date_id = OLD.id
     AND (start_time < NEW.open_time OR start_time + interval '30 minutes' > NEW.close_time);

  IF v_invalid > 0 THEN
    RAISE EXCEPTION 'service_date_change_invalidates_bookings' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER service_dates_guard
BEFORE UPDATE OR DELETE ON service_dates
FOR EACH ROW EXECUTE FUNCTION guard_service_date_changes();
