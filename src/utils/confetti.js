import { toast } from "react-hot-toast";

// --- Particle Class for Confetti Cannon ---
class ConfettiParticle {
  constructor(x, y, angle, velocity, color) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 8 + 6;
    const rad = (angle * Math.PI) / 180;
    this.vx = Math.cos(rad) * velocity * (0.6 + Math.random() * 0.8);
    this.vy = Math.sin(rad) * velocity * (0.6 + Math.random() * 0.8);
    this.color = color;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 12 - 6;
    this.opacity = 1;
    this.gravity = 0.28;
    this.friction = 0.98;
    this.shape = Math.random() > 0.5 ? "square" : "circle";
  }

  update(height) {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;

    // Slow fade out as it descends
    if (this.y > height * 0.3) {
      this.opacity -= 0.014;
    }
  }

  draw(ctx) {
    if (this.opacity <= 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.fillStyle = this.color;

    if (this.shape === "square") {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

let activeAnimId = null;

/**
 * Triggers a dual-cannon confetti celebration on the current attender's screen.
 * Pure lightweight canvas animation — zero external dependencies, 100% local.
 */
export function triggerRegistrationConfetti(leadName = "") {
  if (typeof window === "undefined" || !document) return;

  // 1. Get or create fixed fullscreen canvas
  let canvas = document.getElementById("attender-confetti-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "attender-confetti-canvas";
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "9999999";
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = [
    "#FF2E93", "#FF8A00", "#FF007A", "#FFC700", 
    "#00F0FF", "#9E00FF", "#00FF66", "#3B82F6", "#10B981"
  ];
  const particles = [];

  // Left Cannon (fires up and right)
  for (let i = 0; i < 70; i++) {
    particles.push(
      new ConfettiParticle(
        0,
        canvas.height,
        -45 + (Math.random() * 24 - 12),
        Math.random() * 16 + 16,
        colors[Math.floor(Math.random() * colors.length)]
      )
    );
  }

  // Right Cannon (fires up and left)
  for (let i = 0; i < 70; i++) {
    particles.push(
      new ConfettiParticle(
        canvas.width,
        canvas.height,
        -135 + (Math.random() * 24 - 12),
        Math.random() * 16 + 16,
        colors[Math.floor(Math.random() * colors.length)]
      )
    );
  }

  if (activeAnimId) {
    cancelAnimationFrame(activeAnimId);
  }

  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update(canvas.height);
      particles[i].draw(ctx);
    }

    // Retain only alive particles
    const alive = particles.filter(p => p.opacity > 0 && p.y < canvas.height + 50);

    if (alive.length > 0) {
      particles.length = 0;
      particles.push(...alive);
      activeAnimId = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      activeAnimId = null;
    }
  };

  tick();

  // Show friendly celebratory toast
  const message = leadName 
    ? `🎉 Registration Won for ${leadName}! Great work!` 
    : "🎉 Registration Won! Great work!";
  toast.success(message, {
    duration: 3500,
    position: "top-center",
    style: {
      fontWeight: "bold",
      background: "#064e3b",
      color: "#ecfdf5",
      border: "1px solid #10b981",
      borderRadius: "16px",
      boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4)"
    }
  });
}
