"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { REVEAL_SPEED } from "@/lib/motion";
import DustField from "./dust/DustField";
import { page } from "./content";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Load the source image and read its pixels at natural size. */
function readImage(src: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("Canvas 2D unavailable"));
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/** Particle budget from the device: screen class, cores and memory. */
function particleBudget(mobile: boolean) {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  if (mobile) return cores <= 4 || memory <= 2 ? 3800 : 5600;
  return cores <= 4 || memory <= 4 ? 9000 : 13500;
}

/**
 * Motion for PAGE 02 — "Born from dust".
 *
 * Without motion (reduced-motion) the image is drawn once, fully formed and
 * still, beside two stacked chapters. With motion the section becomes one
 * pinned stage and the dust is driven by:
 *
 *  Entry (once, on arrival): the image assembles from dust over ~5.5 s —
 *  the luminous object first, then the hand, then the outermost dust — and
 *  chapter 01's typography rises once the image is recognisable.
 *
 *  One scrubbed, reversible timeline across the stage:
 *    0.30–0.38  chapter 01 leaves
 *    0.32–0.60  a wave of dust travels out from the object and settles
 *    0.44–0.62  the dust grows slightly livelier; the object's light breathes
 *    0.50–0.62  chapter 02 rises in
 *    0.80–1.00  chapter 02 settles away; the image lets go into the dark
 */
export default function DustMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    (_, contextSafe) => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
          mobile: "(max-width: 699px)",
        },
        (context) => {
          const { motion, mobile } = context.conditions as { motion: boolean; mobile: boolean };
          const q = gsap.utils.selector(root);
          const el = q("[data-chapters]")[0] as HTMLElement | undefined;
          const canvas = q("[data-canvas]")[0] as HTMLCanvasElement | undefined;
          const imageBox = q("[data-image-box]")[0] as HTMLElement | undefined;
          const glow = q("[data-glow]")[0] as HTMLElement | undefined;
          if (!el || !canvas || !imageBox) return;

          let field: DustField | null = null;
          let cancelled = false;

          // The canvas takes over from the static image.
          el.setAttribute("data-dust", "live");
          if (motion) el.setAttribute("data-pinned", "");

          const linesA = q('[data-text="products"] [data-line]');
          const fadeA = q('[data-text="products"] [data-fade]');
          const textA = q('[data-text="products"]');
          const linesB = q('[data-text="systems"] [data-line]');
          const fadeB = q('[data-text="systems"] [data-fade]');
          const textB = q('[data-text="systems"]');
          const head = q("[data-stage-head]");
          const fill = q("[data-progress]");
          const countA = q('[data-count="products"]');
          const countB = q('[data-count="systems"]');

          if (motion) {
            gsap.set(linesA, { yPercent: 115, y: 0 });
            gsap.set(fadeA, { opacity: 0, y: 14 });
            gsap.set(textB, { autoAlpha: 0 });
            gsap.set(linesB, { yPercent: 115, y: 0 });
            gsap.set(fadeB, { opacity: 0, y: 14 });
            gsap.set(fill, { scaleX: 0, transformOrigin: "0% 50%" });
            gsap.set(countB, { opacity: 0.35 });
          }

          const build = contextSafe!((source: ImageData) => {
            if (cancelled) return;
            field = new DustField(canvas, source, {
              imageBox,
              glow,
              orb: page.image.orb,
              crop: page.image.crop,
              pitch: mobile ? 1.7 : 1.9,
              maxParticles: particleBudget(mobile),
            });
            const f = field;

            if (!motion) {
              // Reduced motion: the finished image, drawn once and held still.
              f.params.assemble = 1;
              f.draw(0);
              return;
            }

            // Render only while the stage can be seen; scroll velocity feeds
            // the dust's soft lag.
            const visible = ScrollTrigger.create({
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              onToggle: (self) => (self.isActive ? f.start() : f.stop()),
              onUpdate: (self) => f.setVelocity(self.getVelocity()),
            });

            // Entry: born from dust.
            const entry = gsap
              .timeline({ scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none none" } })
              .timeScale(REVEAL_SPEED) // authored timings below; played at the site's reveal pace
              .to(f.params, { assemble: 1, duration: 5.6, ease: "none" }, 0)
              .to(linesA, { yPercent: 0, duration: 1.3, ease: "power4.out", stagger: 0.11 }, 3.1)
              .to(fadeA, { opacity: 1, y: 0, duration: 1.2, ease: "power3.out", stagger: 0.1 }, 3.5);

            // The stage, scrubbed.
            gsap
              .timeline({
                defaults: { ease: "none" },
                scrollTrigger: {
                  trigger: el,
                  start: "top top",
                  end: "bottom bottom",
                  scrub: 1,
                  invalidateOnRefresh: true,
                  // A reader already moving through the stage must not pass
                  // chapter 01 before its entry has finished: hurry it along.
                  onUpdate: (self) => {
                    if (!entry.isActive()) return;
                    if (self.progress > 0.2) entry.progress(1); // a fast reader: finish it now
                    else if (self.progress > 0.04) entry.timeScale(4);
                  },
                },
              })
              .to(fill, { scaleX: 1, duration: 0.8 }, 0)
              // chapter 01 leaves; dust in motion
              .to(textA, { autoAlpha: 0, y: -22, duration: 0.08, ease: "power1.in" }, 0.3)
              .to(f.params, { wave: 1, duration: 0.28, ease: "sine.inOut" }, 0.32)
              .to(f.params, { energy: 1, duration: 0.18 }, 0.44)
              .to(f.params, { pulse: 1, duration: 0.12 }, 0.5)
              .to(countA, { opacity: 0.35, duration: 0.04 }, 0.46)
              .to(countB, { opacity: 1, duration: 0.04 }, 0.46)
              // chapter 02 emerges
              .to(textB, { autoAlpha: 1, duration: 0.02 }, 0.5)
              .to(linesB, { yPercent: 0, duration: 0.08, ease: "power3.out", stagger: 0.012 }, 0.5)
              .to(fadeB, { opacity: 1, y: 0, duration: 0.07, ease: "power2.out", stagger: 0.012 }, 0.54)
              // the end: chapter 02 settles, the image lets go into the dark
              .to(textB, { autoAlpha: 0, y: -14, duration: 0.1, ease: "power1.in" }, 0.8)
              .to(f.params, { dissolve: 1, duration: 0.2, ease: "sine.in" }, 0.8)
              .to(head, { autoAlpha: 0, duration: 0.08 }, 0.9);

            ScrollTrigger.refresh();
            if (visible.isActive) f.start();
          });

          readImage(page.image.src).then(build, () => {
            // If the image cannot be read, keep the static original visible.
            el.removeAttribute("data-dust");
          });

          // Webfonts change line lengths; measure again once they settle.
          document.fonts?.ready.then(() => ScrollTrigger.refresh());

          return () => {
            cancelled = true;
            field?.destroy();
            field = null;
            el.removeAttribute("data-pinned");
            el.removeAttribute("data-dust");
          };
        },
      );

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
