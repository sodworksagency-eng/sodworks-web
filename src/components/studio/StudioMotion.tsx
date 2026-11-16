"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import FounderDust from "./FounderDust";
import { studio } from "./content";
import { afterLoader } from "@/components/loader/ready";
import { getArrival, reopenedPartWay } from "@/lib/arrival";
import { reveal } from "@/lib/motion";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Motion for /studio.
 *
 *  01  Darkness, then the founders appear under a low warm light while the
 *      camera pushes in slowly. The picture holds long enough to recognise
 *      each of them.
 *  02  The three of them disintegrate into their own dust (FounderDust) —
 *      heads first, left to right — and the frame goes completely dark.
 *  03  THE STUDIO sets in under a passing warm light.
 *  04  The last of the dust gathers to the centre as a thin line of warm
 *      light, which opens to reveal the founding story.
 *
 * The page is held still for the length of the sequence (any scroll, key or
 * touch fast-forwards it). With reduced motion, after a history step back,
 * or if the page is reopened part-way down, the story is simply there.
 *
 * Further down, the player tags above each founder render in as they come
 * into view.
 */
export default function StudioMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const q = gsap.utils.selector(el);
      const html = document.documentElement;
      const mm = gsap.matchMedia();

      // the founders' tags, wherever the page is
      const crew = q("[data-crew]")[0] as HTMLElement;
      ScrollTrigger.create({
        trigger: crew,
        start: "top 72%",
        once: true,
        onEnter: (self) => (self.trigger as HTMLElement).setAttribute("data-in", ""),
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        el.dataset.mode = "static";
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // a link straight to a founder (/studio#raghav), a history step back
        // to the page, or the page reopened part-way down: no opening, just
        // the page. Every other arrival plays it (see lib/arrival).
        const hash = decodeURIComponent(location.hash.slice(1));
        const target = hash ? document.getElementById(hash) : null;
        if (target || getArrival() === "pop" || reopenedPartWay()) {
          el.dataset.mode = "static";
          if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "center" }));
          return;
        }
        el.dataset.mode = "cinematic";

        const canvas = q("[data-canvas]")[0] as HTMLCanvasElement;
        const stage = q("[data-stage]")[0] as HTMLElement;
        const veil = q("[data-veil]")[0] as HTMLElement;
        const warm = q("[data-warm]")[0] as HTMLElement;
        const titleId = q("[data-title-id]")[0] as HTMLElement;
        const title = q("[data-title]")[0] as HTMLElement;
        const beam = q("[data-beam]")[0] as HTMLElement;
        const story = q("[data-story]")[0] as HTMLElement;
        const storyLines = q("[data-story-line]");
        const storyArt = q("[data-story-art]");
        const opening = q("[data-opening]")[0] as HTMLElement;

        html.classList.add("hero-intro-lock");
        window.scrollTo(0, 0);

        let tl: gsap.core.Timeline | null = null;
        let cancelled = false;
        const unlock = () => html.classList.remove("hero-intro-lock");
        const hurry = () => tl?.timeScale(3.5);
        const keys = (e: KeyboardEvent) => {
          if ([" ", "ArrowDown", "PageDown", "Enter", "End"].includes(e.key)) hurry();
        };
        window.addEventListener("wheel", hurry, { passive: true });
        window.addEventListener("touchstart", hurry, { passive: true });
        window.addEventListener("keydown", keys);
        const stopListening = () => {
          window.removeEventListener("wheel", hurry);
          window.removeEventListener("touchstart", hurry);
          window.removeEventListener("keydown", keys);
        };

        const finish = () => {
          unlock();
          stopListening();
          story.style.clipPath = "none";
          opening.style.visibility = "hidden";
          beam.style.visibility = "hidden";
        };

        const img = new Image();
        img.decoding = "async";
        img.src = studio.photo.src;
        // the photograph decoded, and the first-visit loader lifted
        Promise.all([img.decode(), afterLoader()])
          .then(() => {
            if (cancelled) return;
            const small = window.innerWidth < 900 || (navigator.hardwareConcurrency ?? 8) <= 4;
            const dust = new FounderDust(canvas, img, { scale: small ? 0.5 : 1 });
            dust.showPhoto();

            // The sequence's landmarks, in seconds.
            const dissolveAt = 3.6; // the founders begin to turn to dust
            const dissolveEnd = dissolveAt + dust.duration; // the last grain has gone
            const titleAt = dissolveEnd - 0.8; // in near darkness, the title
            const gatherAt = titleAt + 2.4; // the last motes start to gather…
            const gatherFor = 1.4;
            const revealAt = gatherAt + gatherFor; // …into the line that opens on the story
            const dissolve = { t: 0 };
            const motes = { t: 0 };
            const open = { px: 0 };
            const openTo = () => Math.max(window.innerHeight / 2, story.offsetHeight - window.innerHeight / 2) + 8;

            tl = gsap.timeline({ onComplete: finish });
            tl.set(story, { "--open": "0px" })
              // 01 — light on the founders, the camera pushes in
              .to(veil, { opacity: 0, duration: 1.8, ease: "power2.inOut" }, 0.5)
              .fromTo(warm, { opacity: 0 }, { opacity: 1, duration: 2.2, ease: "sine.inOut" }, 0.6)
              .fromTo(stage, { scale: 1 }, { scale: 1.06, duration: 7, ease: "sine.out" }, 0.5)
              // 02 — dust
              .to(
                dissolve,
                { t: dust.duration, duration: dust.duration, ease: "none", onUpdate: () => dust.dissolve(dissolve.t) },
                dissolveAt,
              )
              .to(warm, { opacity: 0, duration: 2.6, ease: "sine.inOut" }, dissolveAt + 0.8)
              // 03 — the title
              .fromTo(
                title,
                { opacity: 0, y: 26, "--sheen": "-60%" },
                { opacity: 1, y: 0, duration: 1.6, ease: "power3.out" },
                titleAt + 0.3,
              )
              .to(title, { "--sheen": "160%", duration: 2.2, ease: "sine.inOut" }, titleAt + 0.4)
              .fromTo(titleId, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.2, ease: "power2.out" }, titleAt + 0.8)
              // 04 — the dust gathers to a line of light
              .to(
                motes,
                {
                  t: revealAt - dissolveEnd,
                  duration: revealAt - dissolveEnd,
                  ease: "none",
                  onUpdate: () => {
                    const p = gsap.utils.clamp(0, 1, (motes.t - (gatherAt - dissolveEnd)) / gatherFor);
                    dust.gather(p, motes.t);
                  },
                },
                dissolveEnd,
              )
              .to([title, titleId], { opacity: 0, y: -14, duration: 0.8, ease: "power2.in" }, gatherAt + 0.3)
              .fromTo(
                beam,
                { scaleX: 0, opacity: 0 },
                { scaleX: 1, opacity: 1, duration: 0.9, ease: "power2.out" },
                revealAt - 0.75,
              )
              .to(canvas, { opacity: 0, duration: 0.4 }, revealAt - 0.2)
              .add(unlock, revealAt + 0.3)
              // the line opens onto the story
              .to(
                open,
                {
                  px: openTo,
                  duration: 1.15,
                  ease: "power3.inOut",
                  onUpdate: () => {
                    story.style.setProperty("--open", `${open.px}px`);
                    beam.style.setProperty("--open", `${open.px}px`);
                  },
                  // fully open: drop the clip now, not at the end of the
                  // timeline — scrolling is already free, and the story may
                  // have grown since its height was measured
                  onComplete: () => {
                    story.style.clipPath = "none";
                  },
                },
                revealAt + 0.1,
              )
              .to(beam, { opacity: 0, duration: 0.7, ease: "sine.in" }, revealAt + 0.6)
              // the founders' table comes up as if a lamp were turned on over it
              // (the story's reveal: at the site's reveal pace, from the same
              // moments of the opening)
              .fromTo(
                storyArt,
                { opacity: 0, scale: 1.035, filter: "brightness(0.35)" },
                {
                  opacity: 1,
                  scale: 1,
                  filter: "brightness(1)",
                  duration: reveal(2.2),
                  ease: "power2.out",
                  clearProps: "filter,transform",
                },
                revealAt + 0.35,
              )
              .fromTo(
                storyLines,
                { opacity: 0, y: 22 },
                { opacity: 1, y: 0, duration: reveal(1.1), stagger: reveal(0.12), ease: "power3.out" },
                revealAt + 0.75,
              );
          })
          .catch(() => {
            // the photograph could not be read — show the story
            if (cancelled) return;
            el.dataset.mode = "static";
            finish();
          });

        return () => {
          cancelled = true;
          tl?.kill();
          stopListening();
          unlock();
          story.style.removeProperty("--open");
          story.style.removeProperty("clip-path");
          opening.style.removeProperty("visibility");
          beam.style.removeProperty("visibility");
        };
      });

      return () => {
        mm.revert();
        // a revisited route is restored from Next's cache: set the tags in again
        crew.removeAttribute("data-in");
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
