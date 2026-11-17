"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import HandsScene, { type SceneState } from "./HandsScene";
import { contact } from "./content";
import { afterLoader } from "@/components/loader/ready";
import { getArrival, reopenedPartWay } from "@/lib/arrival";
import { reveal } from "@/lib/motion";

gsap.registerPlugin(useGSAP);


/**
 * Motion for /contact — the connection.
 *
 *  01  Darkness. Light finds the chrome hand (left) and the human hand
 *      (right) — the photograph is revealed by light, not faded in.
 *  02  Both arms swing in from beyond the frame; each index finger flexes on
 *      its own as they close; the camera pushes in a little.
 *  03  The fingertips meet. A small warm light opens at the point of touch
 *      and slowly fills the dark.
 *  04  The light becomes the page: the contact interface rises in.
 *
 * Plays whenever the page is entered — opened, reloaded or reached by a
 * link (see lib/arrival). A history step back to the page, or a page
 * reopened part-way down, goes straight to the interface, as does reduced
 * motion. Any scroll, key or touch speeds it up; Skip ends it.
 */
export default function ContactMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const q = gsap.utils.selector(el);
      const html = document.documentElement;
      const mm = gsap.matchMedia();

      // A history step back to the page, or the page reopened part-way down,
      // goes straight to the interface; every other arrival plays the opening.
      const skip = getArrival() === "pop" || reopenedPartWay();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        el.dataset.mode = "static";
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (skip) {
          el.dataset.mode = "static";
          return;
        }
        el.dataset.mode = "cinematic";

        const canvas = q("[data-hands]")[0] as HTMLCanvasElement;
        const opening = q("[data-opening]")[0] as HTMLElement;
        const dawn = q("[data-dawn]")[0] as HTMLElement;
        const skipBtn = q("[data-skip]")[0] as HTMLButtonElement;
        const rise = q("[data-rise]");

        html.classList.add("hero-intro-lock");
        window.scrollTo(0, 0);

        let tl: gsap.core.Timeline | null = null;
        let scene: HandsScene | null = null;
        let cancelled = false;
        const st: SceneState = {
          robot: { reach: 0, arm: 0.035, finger: 0.12 },
          human: { reach: 0, arm: -0.028, finger: -0.06 },
          light: 0,
          push: 0,
          glow: 0,
          time: 0,
        };

        const place = () => {
          if (!scene) return;
          const [x, y] = scene.contactOnScreen(1);
          el.style.setProperty("--cx", `${x}px`);
          el.style.setProperty("--cy", `${y}px`);
        };
        const onResize = () => {
          if (!scene) return;
          scene.resize();
          place();
          scene.render(st);
        };
        const hurry = () => tl?.timeScale(3);
        const keys = (e: KeyboardEvent) => {
          if ([" ", "ArrowDown", "PageDown", "Enter", "End"].includes(e.key) && e.target === document.body) hurry();
        };
        window.addEventListener("wheel", hurry, { passive: true });
        window.addEventListener("touchmove", hurry, { passive: true });
        window.addEventListener("keydown", keys);
        window.addEventListener("resize", onResize);
        const stopListening = () => {
          window.removeEventListener("wheel", hurry);
          window.removeEventListener("touchmove", hurry);
          window.removeEventListener("keydown", keys);
          window.removeEventListener("resize", onResize);
        };
        const unlock = () => html.classList.remove("hero-intro-lock");
        const finish = () => {
          unlock();
          stopListening();
          el.dataset.mode = "done";
        };
        const onSkip = () => {
          if (tl) tl.progress(1);
          else finish();
        };
        skipBtn.addEventListener("click", onSkip);

        const img = new Image();
        img.decoding = "async";
        img.src = contact.hands.src;
        // the hands decoded, and the first-visit loader lifted
        Promise.all([img.decode(), afterLoader()])
          .then(() => {
            if (cancelled) return;
            scene = new HandsScene(canvas, img);
            scene.resize();
            place();
            scene.render(st);

            const T = 7.3; // the touch
            tl = gsap.timeline({
              onUpdate: () => {
                st.time = tl!.time();
                scene!.render(st);
              },
              onComplete: finish,
            });
            tl.to(st, { light: 1, duration: 3, ease: "sine.inOut" }, 0.5)
              .to(st, { push: 1, duration: T + 0.4, ease: "sine.inOut" }, 0.2)
              // the reach: a long deliberate approach, then the last distance slowly
              .to(st.robot, { reach: 0.9, duration: 5.2, ease: "sine.inOut" }, 0.6)
              .to(st.human, { reach: 0.9, duration: 5.0, ease: "sine.inOut" }, 0.85)
              .to([st.robot, st.human], { reach: 1, duration: T - 5.85, ease: "power2.out" }, 5.85)
              .to(st.robot, { arm: 0, duration: 6, ease: "sine.inOut" }, 0.6)
              .to(st.human, { arm: 0, duration: 5.8, ease: "sine.inOut" }, 0.85)
              // each index finger finds the other
              .to(st.robot, { finger: -0.1, duration: 5, ease: "sine.inOut" }, 1.8)
              .to(st.human, { finger: 0.015, duration: 4.6, ease: "sine.inOut" }, 2.2)
              // the touch, and the light it makes
              .to(st, { glow: 0.32, duration: 0.6, ease: "power2.out" }, T)
              .to(st, { glow: 1.25, duration: 2.4, ease: "sine.in" }, T + 0.6)
              .fromTo(dawn, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "sine.out" }, T + 0.5)
              .fromTo(
                dawn,
                { "--r": "4vmax" },
                { "--r": "100vmax", duration: 2.6, ease: "sine.inOut" },
                T + 0.5,
              )
              .to(skipBtn, { autoAlpha: 0, duration: 0.4 }, T + 1)
              .add(unlock, T + 2.2)
              // once the page is released, the fading opening lets clicks
              // through to the site index it still covers
              .set(opening, { pointerEvents: "none" }, T + 2.2)
              .to(opening, { autoAlpha: 0, duration: 1.3, ease: "sine.inOut" }, T + 2.3)
              // the interface rises in (at the site's reveal pace)
              .fromTo(
                rise,
                { opacity: 0, y: 26 },
                {
                  opacity: 1,
                  y: 0,
                  duration: reveal(1.1),
                  stagger: reveal(0.08),
                  ease: "power3.out",
                  clearProps: "transform,opacity",
                },
                T + 2.6,
              );
          })
          .catch(() => {
            if (cancelled) return;
            el.dataset.mode = "static";
            finish();
          });

        return () => {
          cancelled = true;
          // revert, not just kill: the timeline is built after the image
          // decodes, outside the GSAP context, and a revisited route replays
          // the opening — it must start from the untouched initial state
          tl?.revert();
          tl = null;
          stopListening();
          skipBtn.removeEventListener("click", onSkip);
          unlock();
          gsap.set([opening, dawn, skipBtn, ...rise], { clearProps: "all" });
        };
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
