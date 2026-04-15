import type { Variants } from "framer-motion"

export const stagger = {
  container: {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.1,
      },
    },
  } satisfies Variants,

  item: {
    hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  } satisfies Variants,

  /** Faster variant for list rows */
  row: {
    hidden: { opacity: 0, x: -8, filter: "blur(2px)" },
    visible: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
    },
  } satisfies Variants,
}
