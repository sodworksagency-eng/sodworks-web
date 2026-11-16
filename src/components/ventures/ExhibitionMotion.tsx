"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { REVEAL_SPEED, reveal } from "@/lib/motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Motion for /ventures.
 *
 *  Intro: restrained entrance — identifier, OUR VENTURES and the statement
 *  rise out of the dark in sequence.
 *
 *  Exhibition, large screens with motion: the viewport pins and the vertical
 *  scroll drives the track horizontally. Inside that one horizontal tween,
 *  each venture's images unmask and drift on their own parallax and its text
 *  sets in independently (ScrollTrigger containerAnimation). The progress
 *  index follows the position and jumps to a venture on click.
 *
 *  Small screens / reduced motion: no pinning. The track is a native,
 *  snap-scrolling horizontal strip; reveals are simple and the index still
 *  tracks and jumps.
 */
export default function ExhibitionMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const exhibition = q("[data-exhibition]")[0] as HTMLElement | undefined;
      const viewport = q("[data-viewport]")[0] as HTMLElement | undefined;
      const track = q("[data-track]")[0] as HTMLElement | undefined;
      const panels = q("[data-panel]") as HTMLElement[];
      const marks = q("[data-progress-mark]") as HTMLAnchorElement[];
      const fill = q("[data-progress-fill]")[0] as HTMLElement | undefined;
      if (!exhibition || !viewport || !track || !panels.length) return;
      const n = panels.length;

      const setActive = (p: number) => {
        const idx = Math.max(0, Math.min(n - 1, Math.round(p * (n - 1))));
        marks.forEach((m, i) => m.toggleAttribute("data-active", i === idx));
        if (fill) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;
      };

      const mm = gsap.matchMedia();

      // ── Intro (any screen, motion allowed)
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ delay: reveal(0.25) })
          .timeScale(REVEAL_SPEED) // authored timings below; played at the site's reveal pace
          .from(q("[data-intro-id]"), { opacity: 0, y: 12, duration: 1, ease: "power2.out" })
          .from(q("[data-intro-line]"), { yPercent: 110, duration: 1.3, ease: "power4.out", stagger: 0.12 }, 0.25)
          .from(q("[data-intro-fade]"), { opacity: 0, y: 14, duration: 1.1, ease: "power3.out", stagger: 0.12 }, 0.9);
      });

      // ── Exhibition: pinned and scroll-driven on large screens
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        exhibition.setAttribute("data-horizontal", "");
        const distance = () => track.scrollWidth - window.innerWidth;

        const travel = gsap.to(track, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            // Pin the whole exhibition so the progress index stays with it.
            trigger: exhibition,
            pin: true,
            start: "top top",
            end: () => `+=${distance()}`,
            scrub: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => setActive(self.progress),
          },
        });

        panels.forEach((panel, i) => {
          const reveals = panel.querySelectorAll<HTMLElement>("[data-reveal]");
          const drifts = panel.querySelectorAll<HTMLElement>("[data-drift]");
          const lines = panel.querySelectorAll<HTMLElement>("[data-line]");
          const rises = panel.querySelectorAll<HTMLElement>("[data-rise]");
          const first = i === 0;

          // Images: unmasked as the stage arrives (the first one on load).
          reveals.forEach((r) => {
            const delay = parseFloat(r.dataset.revealDelay ?? "0");
            gsap.fromTo(
              r,
              { clipPath: "inset(0% 0% 0% 100%)" },
              {
                clipPath: "inset(0% 0% 0% 0%)",
                ease: "power3.out",
                duration: reveal(1.4),
                delay: reveal(first ? 0.6 + delay : delay),
                scrollTrigger: first
                  ? undefined
                  : { trigger: panel, containerAnimation: travel, start: "left 72%", toggleActions: "play none none reverse" },
              },
            );
          });
          // Images drift against the travel — a slow parallax inside each frame.
          drifts.forEach((d) => {
            gsap.fromTo(
              d,
              { xPercent: 6 },
              {
                xPercent: -6,
                ease: "none",
                scrollTrigger: { trigger: panel, containerAnimation: travel, start: "left right", end: "right left", scrub: true },
              },
            );
          });
          // Typography sets in independently of the images.
          const text = gsap.timeline({
            delay: reveal(first ? 0.9 : 0),
            scrollTrigger: first
              ? undefined
              : { trigger: panel, containerAnimation: travel, start: "left 62%", toggleActions: "play none none reverse" },
          });
          text
            .timeScale(REVEAL_SPEED) // authored timings below; played at the site's reveal pace
            .from(lines, { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.1 })
            .from(rises, { opacity: 0, y: 16, duration: 0.9, ease: "power3.out", stagger: 0.1 }, 0.25);
        });

        // Index marks jump to their venture along the pinned scroll.
        const st = travel.scrollTrigger!;
        const onMark = (e: Event) => {
          const i = Number((e.currentTarget as HTMLElement).dataset.progressMark);
          e.preventDefault();
          const y = st.start + (st.end - st.start) * (i / (n - 1));
          window.scrollTo({ top: y + 2, behavior: "smooth" });
        };
        marks.forEach((m) => m.addEventListener("click", onMark));
        setActive(0);

        return () => {
          marks.forEach((m) => m.removeEventListener("click", onMark));
          exhibition.removeAttribute("data-horizontal");
        };
      });

      // ── Exhibition: native horizontal strip (small screens / reduced motion)
      mm.add("(max-width: 899px), (prefers-reduced-motion: reduce)", () => {
        // Stages start masked only when motion is allowed (and JS is running).
        const reduceNow = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduceNow) exhibition.setAttribute("data-strip-motion", "");
        // Wide screens without motion keep full-width stages, snap-scrolled.
        if (window.matchMedia("(min-width: 900px)").matches) exhibition.setAttribute("data-wide", "");
        const onScroll = () => {
          const max = viewport.scrollWidth - viewport.clientWidth;
          setActive(max > 0 ? viewport.scrollLeft / max : 0);
        };
        viewport.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        // Reveal each stage as it snaps into view (CSS transitions do the work).
        const io = new IntersectionObserver(
          (entries) => entries.forEach((e) => e.isIntersecting && e.target.setAttribute("data-in", "")),
          { root: viewport, threshold: 0.35 },
        );
        panels.forEach((p) => io.observe(p));
        const onMark = (e: Event) => {
          const i = Number((e.currentTarget as HTMLElement).dataset.progressMark);
          e.preventDefault();
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          viewport.scrollTo({ left: panels[i].offsetLeft - viewport.offsetLeft, behavior: reduce ? "auto" : "smooth" });
        };
        marks.forEach((m) => m.addEventListener("click", onMark));
        return () => {
          exhibition.removeAttribute("data-strip-motion");
          exhibition.removeAttribute("data-wide");
          // a revisited route is restored from Next's cache: reveal again
          panels.forEach((p) => p.removeAttribute("data-in"));
          viewport.removeEventListener("scroll", onScroll);
          io.disconnect();
          marks.forEach((m) => m.removeEventListener("click", onMark));
        };
      });

      document.fonts?.ready.then(() => ScrollTrigger.refresh());
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
