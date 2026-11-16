"use client";

import { useEffect, useRef } from "react";

// the shared overlay layer (.glow-cursor, .sw-cursor) — phones never load
// GlowCursor itself, so the layer's styles must come with this component too
import "./GlowCursor.css";

type Props = {
  /** Colour of the freshly drawn light (as GlowCursor's `color`). */
  color: string;
  /** Colour the light cools to (as GlowCursor's `secondaryColor`). */
  secondaryColor: string;
  /** Seconds the trail stays before it has faded. */
  linger?: number;
  className?: string;
};

/** A trail sample; `s` is its stroke, so separate touches never join up. */
type Point = { x: number; y: number; t: number; s: number };
type Bloom = { x: number; y: number; t: number };

/** Below-native resolution keeps the light soft and the fill rate low. */
const RESOLUTION = 0.5;
const MAX_DPR = 1.5;
const MAX_POINTS = 48;

const rgb = (hex: string) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/**
 * TouchGlow — the fallback light for touch screens whose browser lacks
 * WebGL2 float render targets (everywhere else, touch screens run the
 * GlowCursor simulation itself; see SiteGlowCursor).
 *
 * The same warm light, drawn for a finger instead of a pointer: a short
 * trail that follows a moving touch and cools as it fades, with a small
 * white-hot tip, and a soft bloom where a finger lands. It is a plain 2D
 * canvas at reduced resolution, not the WebGL fluid simulation, so it costs
 * almost nothing: it draws only while a touch is moving or a trail is still
 * fading, and the loop stops entirely once the screen is dark again.
 *
 * Touch listeners are passive and the layer never receives pointer events,
 * so scrolling, taps and gestures are untouched.
 */
export default function TouchGlow({ color, secondaryColor, linger = 0.6, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;

    const [r1, g1, b1] = rgb(color);
    const [r2, g2, b2] = rgb(secondaryColor);
    const points: Point[] = [];
    const blooms: Bloom[] = [];
    // the finger, and the light following it on a critically damped spring
    // (as GlowCursor's emitter does), so the head moves continuously between
    // the irregular touch samples instead of jumping from one to the next
    const finger = { x: 0, y: 0, down: false };
    const light = { x: 0, y: 0, vx: 0, vy: 0 };
    const OMEGA = 46;
    let stroke = 0;
    let scale = 1;
    let raf = 0;
    let last = 0;

    // Sized from the layer itself (.sw-cursor: a stable large-viewport
    // height), and only when that size really changes: resizing a canvas
    // clears it, so following every address-bar movement wiped the trail.
    const layer = canvas.parentElement ?? canvas;
    const resize = () => {
      const next = Math.min(window.devicePixelRatio || 1, MAX_DPR) * RESOLUTION;
      const w = Math.max(1, Math.round(layer.clientWidth * next));
      const h = Math.max(1, Math.round(layer.clientHeight * next));
      if (w === canvas.width && h === canvas.height && next === scale) return;
      scale = next;
      canvas.width = w;
      canvas.height = h;
    };

    const follow = (dt: number, now: number) => {
      const steps = Math.max(1, Math.ceil(dt / 0.004));
      const h = dt / steps;
      for (let k = 0; k < steps; k++) {
        light.vx += (OMEGA * OMEGA * (finger.x - light.x) - 2 * OMEGA * light.vx) * h;
        light.vy += (OMEGA * OMEGA * (finger.y - light.y) - 2 * OMEGA * light.vy) * h;
        light.x += light.vx * h;
        light.y += light.vy * h;
      }
      const tail = points[points.length - 1];
      if (!tail || tail.s !== stroke || Math.hypot(light.x - tail.x, light.y - tail.y) > 0.75) {
        points.push({ x: light.x, y: light.y, t: now, s: stroke });
        if (points.length > MAX_POINTS) points.shift();
      }
    };

    const frame = (ms: number) => {
      raf = 0;
      const now = ms / 1000;
      const dt = last ? Math.min(1 / 30, (ms - last) / 1000) : 1 / 60;
      last = ms;
      const moving = finger.down || Math.hypot(light.vx, light.vy) > 1;
      if (moving) follow(dt, now);
      while (points.length && now - points[0].t > linger) points.shift();
      while (blooms.length && now - blooms[0].t > linger) blooms.shift();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!points.length && !blooms.length && !moving) {
        last = 0;
        return; // dark again: the loop stops
      }

      ctx.save();
      ctx.scale(scale, scale);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // the trail: a soft halo, then a bright core, cooling and thinning with age
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (a.s !== b.s) continue; // never join two separate touches
        const life = 1 - (now - b.t) / linger;
        if (life <= 0) continue;
        const fresh = life * life;
        const r = Math.round(r2 + (r1 - r2) * fresh);
        const g = Math.round(g2 + (g1 - g2) * fresh);
        const bl = Math.round(b2 + (b1 - b2) * fresh);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${0.22 * fresh})`;
        ctx.lineWidth = 20 * (0.5 + life * 0.5);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = `rgba(${r1}, ${g1}, ${b1}, ${0.9 * fresh})`;
        ctx.lineWidth = 3.4 * (0.4 + life * 0.6);
        ctx.stroke();
      }

      // the tip: warm glow with a small white-hot centre
      const head = points[points.length - 1];
      if (head && head.s === stroke) {
        const life = 1 - (now - head.t) / linger;
        if (life > 0) {
          const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 34);
          glow.addColorStop(0, `rgba(255, 236, 214, ${0.55 * life})`);
          glow.addColorStop(0.18, `rgba(${r1}, ${g1}, ${b1}, ${0.32 * life})`);
          glow.addColorStop(1, `rgba(${r2}, ${g2}, ${b2}, 0)`);
          ctx.fillStyle = glow;
          ctx.fillRect(head.x - 34, head.y - 34, 68, 68);
        }
      }

      // where a finger lands: a soft bloom that opens and fades
      for (const bloom of blooms) {
        const p = (now - bloom.t) / linger;
        const radius = 14 + p * 46;
        const alpha = 0.3 * (1 - p) * (1 - p);
        const g = ctx.createRadialGradient(bloom.x, bloom.y, 0, bloom.x, bloom.y, radius);
        g.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${alpha})`);
        g.addColorStop(1, `rgba(${r2}, ${g2}, ${b2}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(bloom.x - radius, bloom.y - radius, radius * 2, radius * 2);
      }

      ctx.restore();
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };

    // a new touch starts its own stroke; the previous one keeps fading
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      stroke += 1;
      finger.x = light.x = t.clientX;
      finger.y = light.y = t.clientY;
      light.vx = light.vy = 0;
      finger.down = true;
      blooms.push({ x: t.clientX, y: t.clientY, t: performance.now() / 1000 });
      wake();
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      finger.x = t.clientX;
      finger.y = t.clientY;
      wake();
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length) return;
      finger.down = false;
      wake();
    };
    const onVisibility = () => {
      if (!document.hidden) return;
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      finger.down = false;
      light.vx = light.vy = 0;
      points.length = 0;
      blooms.length = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(layer);
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [color, secondaryColor, linger]);

  return (
    <div className={`glow-cursor ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="glow-cursor__canvas" />
    </div>
  );
}
