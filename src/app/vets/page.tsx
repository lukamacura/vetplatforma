import type { Metadata } from "next"
import { VetRegisterForm } from "./vet-register-form"

export const metadata: Metadata = {
  title: "Registracija veterinara",
  description: "Otvorite nalog za vašu veterinarsku kliniku na VetPlatformi — 30 dana probnog perioda, bez kartice.",
  alternates: { canonical: "/vets" },
}

export default function VetsPage() {
  return <VetRegisterForm />
}
