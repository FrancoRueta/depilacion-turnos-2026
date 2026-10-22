export type FieldErrors = Record<string, string>;

export interface BookingDraft {
  fullName: string;
  age: string;
  zones: string[];
  phone: string;
}

export interface BookingDetails {
  fullName: string;
  age: number;
  zones: string[];
  phone: string;
}

export interface ServiceDateConfig {
  date: string;
  openTime: string;
  closeTime: string;
  active: boolean;
}

export type PublicSlotStatus = "available" | "booked" | "past";

export interface PublicSlot {
  time: string;
  status: PublicSlotStatus;
  initials?: string;
}

export interface PublicServiceDate {
  date: string;
  openTime: string;
  closeTime: string;
  slots: PublicSlot[];
}

export interface PublicMonthResponse {
  month: string;
  dates: PublicServiceDate[];
}

export interface PublicBookingRequest extends BookingDetails {
  date: string;
  startTime: string;
}

export interface BookingConfirmation {
  date: string;
  startTime: string;
  createdAt: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    fields?: FieldErrors;
    details?: Record<string, unknown>;
  };
}

export interface AdminSessionResponse {
  authenticated: boolean;
  username?: string;
}

export interface AdminBooking {
  id: string;
  serviceDateId: string;
  date: string;
  startTime: string;
  fullName: string;
  age: number;
  zones: string[];
  phone: string;
  createdAt: string;
}

export interface AdminServiceDate {
  id: string;
  date: string;
  openTime: string;
  closeTime: string;
  active: boolean;
  bookings: AdminBooking[];
}

export interface AdminMonthResponse {
  month: string;
  dates: AdminServiceDate[];
}

export interface AdminDatePayload {
  date: string;
  openTime: string;
  closeTime: string;
  active: boolean;
}

export interface AdminBookingPayload extends BookingDetails {
  date: string;
  startTime: string;
}
