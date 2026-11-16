"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { REVEAL_SPEED } from "@/lib/motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * The homepage previews (ventures, studio): the title sets in, each image
 * unmasks as it arrives, and the images drift at their own speeds while the
 * section passes — restrained, scrubbed, reversible. Nothing moves under
 * reduced motion.
 */
export default function PreviewMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        const section = root.current!;
        gsap
          // starts as the section enters, so the images are open by the time
          // they reach the middle of the screen, however briskly it is scrolled
          .timeline({ scrollTrigger: { trigger: section, start: "top 88%", toggleActions: "play none none none" } })
          .timeScale(REVEAL_SPEED) // authored timings below; played at the site's reveal pace
          .from(q("[data-pv-line]"), { yPercent: 110, duration: 1.2, ease: "power4.out", stagger: 0.12 })
          .from(q("[data-pv-rise]"), { opacity: 0, y: 16, duration: 1, ease: "power3.out", stagger: 0.1 }, 0.2)
          .fromTo(
            q("[data-pv-mask]"),
            { clipPath: "inset(100% 0% 0% 0%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "power3.inOut", stagger: 0.18 },
            0.1,
          );
        (q("[data-pv-work]") as HTMLElement[]).forEach((w) => {
          const d = parseFloat(w.dataset.speed ?? "0");
          gsap.fromTo(
            w,
            { y: -d },
            { y: d, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 1 } },
          );
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
