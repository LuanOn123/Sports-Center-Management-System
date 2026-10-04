import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import "./publicMotion.css";

export function usePublicMotion<T extends HTMLElement>() {
  const root = useRef<T>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    const reveals = [
      ...node.querySelectorAll<HTMLElement>(
        ".lp-section, .lp-platform-section, .lp-faq, .lp-cta-wrap",
      ),
    ];
    const setup = () => {
      observer?.disconnect();
      reveals.forEach((el) =>
        el.classList.remove("motion-wait", "motion-visible"),
      );
      if (preference.matches) return;
      observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("motion-visible");
              observer?.unobserve(entry.target);
            }
          }),
        { threshold: 0.06 },
      );
      reveals.forEach((el) => {
        el.classList.add("motion-wait");
        observer?.observe(el);
      });
    };
    setup();
    preference.addEventListener("change", setup);
    const updateNavigation = () => {
      node.classList.toggle("motion-scrolled", window.scrollY > 24);
      const sections = [...node.querySelectorAll<HTMLElement>("section[id]")];
      const current = sections
        .filter((el) => el.getBoundingClientRect().top <= 180)
        .at(-1)?.id;
      node
        .querySelectorAll<HTMLAnchorElement>("nav a[href^='#']")
        .forEach((link) => {
          if (link.hash === `#${current}`)
            link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
    };
    const scroll = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          updateNavigation();
          frame = 0;
        });
    };
    updateNavigation();
    window.addEventListener("scroll", scroll, { passive: true });
    const areas = [
      ...node.querySelectorAll<HTMLElement>(".auth-story, .lp-hero-visual"),
    ];
    const move = (event: PointerEvent) => {
      if (
        preference.matches ||
        node.dataset.motion === "paused" ||
        event.pointerType !== "mouse"
      )
        return;
      const area = event.currentTarget as HTMLElement;
      const rect = area.getBoundingClientRect();
      area.style.setProperty(
        "--pointer-x",
        `${((event.clientX - rect.left) / rect.width - 0.5) * 12}px`,
      );
      area.style.setProperty(
        "--pointer-y",
        `${((event.clientY - rect.top) / rect.height - 0.5) * 12}px`,
      );
    };
    const leave = (event: PointerEvent) => {
      const area = event.currentTarget as HTMLElement;
      area.style.setProperty("--pointer-x", "0px");
      area.style.setProperty("--pointer-y", "0px");
    };
    areas.forEach((area) => {
      area.addEventListener("pointermove", move);
      area.addEventListener("pointerleave", leave);
    });
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", setup);
      window.removeEventListener("scroll", scroll);
      areas.forEach((area) => {
        area.removeEventListener("pointermove", move);
        area.removeEventListener("pointerleave", leave);
      });
    };
  }, []);
  return root;
}

export function AmbientMotion() {
  const [paused, setPaused] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const host = button.current?.closest<HTMLElement>(
      ".pulse-auth, .pulse-landing",
    );
    if (host) host.dataset.motion = paused ? "paused" : "playing";
  }, [paused]);
  return (
    <>
      <div className="ambient-motion" aria-hidden="true">
        <div className="ambient-gradient" />
        <span className="ambient-glow ambient-glow-orange" />
        <span className="ambient-glow ambient-glow-red" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i className={`ambient-particle particle-${i}`} key={i} />
        ))}
      </div>
      <button
        ref={button}
        className="motion-toggle"
        type="button"
        aria-pressed={paused}
        onClick={() => setPaused(!paused)}
        aria-label={paused ? "Bật hiệu ứng chuyển động" : "Tạm dừng hiệu ứng"}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
        <span>Hiệu ứng</span>
      </button>
    </>
  );
}
