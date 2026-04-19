import type { Metadata } from "next"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Prijava",
  description:
    "Prijavite se na VetPlatformu — digitalno zakazivanje termina, kartoni ljubimaca i komunikacija sa Vašom veterinarskom klinikom.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Prijava · VetPlatforma",
    description:
      "Prijavite se na VetPlatformu — digitalno zakazivanje termina i upravljanje brigom o ljubimcu.",
    url: "/login",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prijava · VetPlatforma",
    description:
      "Prijavite se na VetPlatformu — digitalno zakazivanje termina i upravljanje brigom o ljubimcu.",
  },
}

export default function LoginPage() {
  return <LoginForm />
}
