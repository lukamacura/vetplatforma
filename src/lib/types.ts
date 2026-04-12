export type Role               = 'vet' | 'owner'
export type Species            = 'dog' | 'cat' | 'bird' | 'other'
export type Gender             = 'male' | 'female' | 'unknown'
export type AppointmentStatus  = 'confirmed' | 'cancelled' | 'no_show'
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled'

export interface Clinic {
  id:                  string
  name:                string
  slug:                string
  owner_id:            string
  created_at:          string
  trial_started_at:    string | null
  subscription_status: SubscriptionStatus
  stripe_customer_id:  string | null
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
  vet_notes:          string | null
  created_at:         string
}

export interface Connection {
  id:           string
  owner_id:     string
  clinic_id:    string
  connected_at: string
}

export interface Service {
  id:               string
  clinic_id:        string
  name:             string
  duration_minutes: 15 | 30 | 60
  description:      string | null
  is_active:        boolean
  created_at:       string
}

export interface Appointment {
  id:           string
  clinic_id:    string
  pet_id:       string
  service_id:   string
  owner_id:     string
  scheduled_at: string
  status:       AppointmentStatus
  created_at:   string
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
  owner_name:       string
  service_name:     string
  service_duration: number
}

export interface PetWithOwner extends Pet {
  owner_name: string
}
