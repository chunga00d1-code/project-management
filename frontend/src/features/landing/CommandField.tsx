import { useEffect, useRef } from "react";

export function CommandField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let raf = 0;
    const pointer = { x: .5, y: .4 };
    const particleCount = reduced ? 18 : innerWidth < 480 ? 32 : 62;
    const particles = Array.from({ length: particleCount }, (_, i) => ({
      x: (i * 47 % 101) / 101,
      y: (i * 83 % 97) / 97,
      vx: Math.sin(i) * .00012,
      vy: Math.cos(i * 2) * .0001,
      r: 1 + i % 3,
    }));

    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const move = (event: PointerEvent) => {
      pointer.x = event.clientX / innerWidth;
      pointer.y = event.clientY / innerHeight;
    };
    const draw = () => {
      frame += .008;
      ctx.clearRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(pointer.x * width, pointer.y * height, 0, pointer.x * width, pointer.y * height, width * .46);
      glow.addColorStop(0, "rgba(49,255,184,.12)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      particles.forEach((particle, index) => {
        if (!reduced) {
          particle.x = (particle.x + particle.vx + 1) % 1;
          particle.y = (particle.y + particle.vy + 1) % 1;
        }
        const x = particle.x * width;
        const y = particle.y * height;
        for (let next = index + 1; next < particles.length; next++) {
          const neighbour = particles[next];
          const neighbourX = neighbour.x * width;
          const neighbourY = neighbour.y * height;
          const distance = Math.hypot(x - neighbourX, y - neighbourY);
          if (distance < 130) {
            ctx.strokeStyle = `rgba(105,244,195,${(1 - distance / 130) * .12})`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(neighbourX, neighbourY);
            ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(120,255,208,${.25 + particle.r * .14})`;
        ctx.beginPath();
        ctx.arc(x + Math.sin(frame + index) * 3, y, particle.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    addEventListener("resize", resize);
    if (!reduced) addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      if (!reduced) removeEventListener("pointermove", move);
    };
  }, []);

  return <canvas ref={canvasRef} className="pf-command-field" aria-hidden="true" />;
}
