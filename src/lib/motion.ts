/**
 * The pace of the site's reveals.
 *
 * Every reveal — scroll-triggered entrances, image unmasks, text rises and
 * their staggers — plays at REVEAL_SPEED times its authored speed: each
 * duration, delay and stagger is the authored value ÷ REVEAL_SPEED, with the
 * same easing and the same order. Whole reveal timelines take it as a GSAP
 * timeScale; single values go through reveal(). CSS reveals use the same
 * factor through --reveal-speed (globals.css).
 *
 * The cinematic sequences keep their own timing: the homepage film, the
 * Studio and Contact openings and the first-visit loader.
 */
export const REVEAL_SPEED = 1.3;

/** An authored reveal time, in seconds, at the site's reveal pace. */
export const reveal = (seconds: number) => seconds / REVEAL_SPEED;
