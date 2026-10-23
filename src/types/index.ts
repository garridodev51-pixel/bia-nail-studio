export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Service {
  id: string;
  name: string;
  price: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  full_name: string;
  phone: string;
  notes?: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  service_id: string;
  service_name: string;
  service_price: number;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  service?: Service;
}

export interface WorkingHours {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_open: boolean;
}

export interface AvailableSlot {
  id: string;
  date: string | null;
  time: string;
  is_available: boolean;
  day_of_week?: number | null;
}

export interface BlockedSlot {
  id: string;
  date: string;
  time?: string | null;
  reason?: string | null;
}

export interface BookingFormData {
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  date: string;
  time: string;
  fullName: string;
  phone: string;
  notes?: string;
}
