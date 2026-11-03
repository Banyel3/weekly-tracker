// adapted from https://github.com/ibelick/motion-primitives/blob/main/components/core/animated-group.tsx
"use client";

import React, { type ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { TRANSITION, useReducedMotion } from "./config";

export type AnimatedGroupProps = {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  variants?: { container?: Variants; item?: Variants };
};

const defaultContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: TRANSITION },
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
