"use client"

import Image from "next/image"
import type { Species } from "@/lib/types"

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕", cat: "🐈", bird: "🐦", other: "🐾",
}

export interface PetAvatarProps {
  photoUrl?: string | null
  species: Species | string
  size?: number
  className?: string
  outline?: string
  outlineOffset?: string
  rounded?: "full" | "xl" | "2xl"
}

export function PetAvatar({
  photoUrl,
  species,
  size = 40,
  className = "",
  outline,
  outlineOffset,
  rounded = "full",
}: PetAvatarProps) {
  const borderRadius =
    rounded === "full" ? "50%" : rounded === "2xl" ? 16 : 12

  const emoji = SPECIES_EMOJI[species] ?? "🐾"
  const fontSize = size >= 56 ? size * 0.5 : size >= 40 ? size * 0.45 : size * 0.4

  if (photoUrl) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius,
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08), 0 0 0 2px rgba(255,255,255,0.9)",
          outline,
          outlineOffset,
        }}
      >
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius,
        flexShrink: 0,
        background: "rgba(255,255,255,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        lineHeight: 1,
        boxShadow: "0 2px 10px rgba(0,0,0,0.06), inset 0 -1px 3px rgba(0,0,0,0.04)",
        userSelect: "none",
        outline,
        outlineOffset,
      }}
    >
      {emoji}
    </div>
  )
}

export default PetAvatar
