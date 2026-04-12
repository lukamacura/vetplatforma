import { LogoutButton } from "@/components/ui/logout-button"
import { OwnerBottomNav } from "@/components/ui/owner-bottom-nav"

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F9FB] pb-20">
      <header className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
          <span className="font-semibold text-sm text-[#2BB5A0]">VetPlatforma</span>
          <LogoutButton />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 pt-6">{children}</main>
      <OwnerBottomNav />
    </div>
  )
}
