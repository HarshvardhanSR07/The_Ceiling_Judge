
import React from "react";
import { motion } from "framer-motion";

export function StaggeredText({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");

  const container: any = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.04 * i },
    }),
  };

  const child: any = {
    visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 20, stiffness: 200 } },
    hidden: { opacity: 0, y: 30, transition: { type: "spring", damping: 20, stiffness: 200 } },
  };

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {words.map((word, index) => (
        <motion.span variants={child} key={index} className="inline-block mr-[0.25em]">
          {word}
        </motion.span>
      ))}
    </motion.div>
  );
}


