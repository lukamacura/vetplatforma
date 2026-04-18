import type { Species } from './species'
export type { Species }

export type Role               = 'vet' | 'owner'
export type Gender             = 'male' | 'female' | 'unknown'
export type AppointmentStatus  = 'confirmed' | 'cancelled' | 'no_show'
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled'

export interface Clinic {
  id:                                  string
  name:                                string
  slug:                                string
  owner_id:                            string
  created_at:                          string
  trial_started_at:                    string | null
  subscription_status:                 SubscriptionStatus
  subscription_current_period_end:     string | null
  subscription_cancel_at_period_end:   boolean
  stripe_customer_id:                  string | null
}

export interface Profile {
  id:         string
  role:       Role
  full_name:  string
  phone:      string | null
  clinic_id:  string | null
  created_at: string
}

export interface Pet {
  id:                 string
  owner_id:           string
  name:               string
  species:            Species
  breed:              string | null
  birth_date:         string | null
  weight_kg:          number | null
  next_vaccine_date:  string | null
  next_control_date:  string | null
  chip_id:            string | null
  passport_number:    string | null
  gender:             Gender | null
  color:              string | null
  photo_url:          string | null
  vet_notes:          string | null
  owner_notes:        string | null
  vaccine_note:       string | null
  created_at:         string
}

export interface Connection {
  id:           string
  owner_id:     string
  clinic_id:    string
  connected_at: string
}

export interface Service {
  id:                   string
  clinic_id:            string
  name:                 string
  duration_minutes:     number
  description:          string | null
  price_rsd:            number
  buffer_after_minutes: number
  is_active:            boolean
  created_at:           string
}

export interface Appointment {
  id:           string
  clinic_id:    string
  pet_id:       string
  service_id:   string
  owner_id:     string
  scheduled_at: string
  status:       AppointmentStatus
  booked_by:    'owner' | 'vet'
  vet_notes:    string | null
  created_at:   string
}

export interface OwnerDayNote {
  owner_id:   string
  day:        string   // YYYY-MM-DD (Postgres date)
  note:       string
  updated_at: string
}

export interface ClinicHours {
  id:         string
  clinic_id:  string
  weekday:    number   // 0=Sunday, 1=Monday, ..., 6=Saturday
  open_time:  string | null   // HH:MM
  close_time: string | null   // HH:MM
  is_closed:  boolean
}

// Joined types for UI
export interface AppointmentWithDetails extends Appointment {
  pet_name:         string
  pet_species:      Species
  pet_photo_url:    string | null
  owner_name:       string
  service_name:     string
  service_duration: number
}

export interface PetWithOwner extends Pet {
  owner_name: string
}
