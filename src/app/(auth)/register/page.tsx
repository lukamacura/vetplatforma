import type { Metadata } from "next"
import { RegisterForm } from "./register-form"

export const metadata: Metadata = {
  title: "Registracija",
  description:
    "Otvorite besplatan nalog na VetPlatformi — veterinari dobijaju 30 dana probnog perioda, a vlasnici ljubimaca zakazuju termine i vode digitalni karton ljubimca.",
  alternates: { canonical: "/register" },
  openGraph: {
    title: "Registracija · VetPlatforma",
    description:
      "Besplatna registracija — za veterinare i vlasnike ljubimaca. 30 dana probnog perioda, bez kartice.",
    url: "/register",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Registracija · VetPlatforma",
    description:
      "Besplatna registracija — za veterinare i vlasnike ljubimaca. 30 dana probnog perioda, bez kartice.",
  },
}

export default function RegisterPage() {
  return <RegisterForm />
}
