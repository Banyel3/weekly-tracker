// adapted from https://github.com/ibelick/motion-primitives/blob/main/components/core/animated-group.tsx
"use client";

import React, { type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

export type AnimatedGroupProps = {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  variants?: { container?: Variants; item?: Variants };
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const defaultContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.15, ease: EASE_OUT } },
};

function AnimatedGroup({ children, className, itemClassName, variants }: AnimatedGroupProps) {
  const reduced = useReducedMotion();
  const items = React.Children.toArray(children);

  if (reduced) {
    return (
      <div className={className}>
        {items.map((child, index) => (
          <div key={index} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants?.container ?? defaultContainerVariants}
      className={className}
    >
      {items.map((child, index) => (
        <motion.div key={index} variants={variants?.item ?? defaultItemVariants} className={itemClassName}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export { AnimatedGroup };
