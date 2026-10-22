import { generateSlotTimes, getBusinessToday, isSlotPast, monthBounds } from "../../shared/dates";
import { getInitials } from "../../shared/initials";
import type {
  AdminBooking,
  AdminMonthResponse,
  AdminServiceDate,
  PublicMonthResponse,
  PublicServiceDate,
  PublicSlot,
} from "../../shared/types";
import type { Database } from "../db";

interface ServiceDateRow {
  id: string;
  date: string;
  open_time: string;
  close_time: string;
  active: boolean;
}

interface PublicBookingRow {
  service_date_id: string;
  start_time: string;
  full_name: string;
}

interface AdminBookingRow {
  id: string;
  service_date_id: string;
  date: string;
  start_time: string;
  full_name: string;
  age: number;
  zones: string[];
  phone: string;
  created_at: string;
}

const SERVICE_DATE_SELECT = `
  SELECT id,
         to_char(date, 'YYYY-MM-DD') AS date,
         to_char(open_time, 'HH24:MI') AS open_time,
         to_char(close_time, 'HH24:MI') AS close_time,
         active
    FROM service_dates
`;

export async function getPublicMonth(
  db: Database,
  month: string,
  now: Date = new Date(),
): Promise<PublicMonthResponse> {
  const today = getBusinessToday(now);
  const currentMonth = today.slice(0, 7);
  if (month < currentMonth) {
    return { month, dates: [] };
  }

  const bounds = monthBounds(month);
  const start = month === currentMonth ? today : bounds.start;

  const dateRows = await db.query<ServiceDateRow>(
    `${SERVICE_DATE_SELECT}
      WHERE active = TRUE
        AND date >= $1::date
        AND date < $2::date
      ORDER BY date ASC`,
    [start, bounds.endExclusive],
  );

  if (dateRows.length === 0) {
    return { month, dates: [] };
  }

  const bookingRows = await db.query<PublicBookingRow>(
    `SELECT b.service_date_id,
            to_char(b.start_time, 'HH24:MI') AS start_time,
            b.full_name
       FROM bookings b
       JOIN service_dates sd ON sd.id = b.service_date_id
      WHERE sd.active = TRUE
        AND sd.date >= $1::date
        AND sd.date < $2::date
      ORDER BY b.start_time ASC`,
    [start, bounds.endExclusive],
  );

  const bookingsByDate = new Map<string, PublicBookingRow[]>();
  for (const booking of bookingRows) {
    const list = bookingsByDate.get(booking.service_date_id) ?? [];
    list.push(booking);
    bookingsByDate.set(booking.service_date_id, list);
  }

  const dates: PublicServiceDate[] = dateRows.map((serviceDate) => {
    const bookings = bookingsByDate.get(serviceDate.id) ?? [];
    const bookingByTime = new Map(bookings.map((booking) => [booking.start_time, booking]));

    const slots: PublicSlot[] = generateSlotTimes(serviceDate.open_time, serviceDate.close_time).map(
      (time) => {
        const booking = bookingByTime.get(time);
        if (booking) {
          return {
            time,
            status: "booked",
            initials: getInitials(booking.full_name),
          };
        }
        if (isSlotPast(serviceDate.date, time, now)) {
          return { time, status: "past" };
        }
        return { time, status: "available" };
      },
    );

    return {
      date: serviceDate.date,
      openTime: serviceDate.open_time,
      closeTime: serviceDate.close_time,
      slots,
    };
  });

  return { month, dates };
}

export async function getAdminMonth(
  db: Database,
  month: string,
): Promise<AdminMonthResponse> {
  const bounds = monthBounds(month);

  const dateRows = await db.query<ServiceDateRow>(
    `${SERVICE_DATE_SELECT}
      WHERE date >= $1::date
        AND date < $2::date
      ORDER BY date ASC`,
    [bounds.start, bounds.endExclusive],
  );

  if (dateRows.length === 0) {
    return { month, dates: [] };
  }

  const bookingRows = await db.query<AdminBookingRow>(
    `SELECT b.id,
            b.service_date_id,
            to_char(sd.date, 'YYYY-MM-DD') AS date,
            to_char(b.start_time, 'HH24:MI') AS start_time,
            b.full_name,
            b.age,
            b.zones,
            b.phone,
            to_char(b.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
       FROM bookings b
       JOIN service_dates sd ON sd.id = b.service_date_id
      WHERE sd.date >= $1::date
        AND sd.date < $2::date
      ORDER BY sd.date ASC, b.start_time ASC`,
    [bounds.start, bounds.endExclusive],
  );

  const bookingsByDate = new Map<string, AdminBookingRow[]>();
  for (const booking of bookingRows) {
    const list = bookingsByDate.get(booking.service_date_id) ?? [];
    list.push(booking);
    bookingsByDate.set(booking.service_date_id, list);
  }

  const dates: AdminServiceDate[] = dateRows.map((serviceDate) => {
    const bookings: AdminBooking[] = (bookingsByDate.get(serviceDate.id) ?? []).map(
      (booking) => ({
        id: booking.id,
        serviceDateId: booking.service_date_id,
        date: booking.date,
        startTime: booking.start_time,
        fullName: booking.full_name,
        age: booking.age,
        zones: Array.isArray(booking.zones) ? booking.zones : [],
        phone: booking.phone,
        createdAt: booking.created_at,
      }),
    );

    return {
      id: serviceDate.id,
      date: serviceDate.date,
      openTime: serviceDate.open_time,
      closeTime: serviceDate.close_time,
      active: serviceDate.active,
      bookings,
    };
  });

  return { month, dates };
}
