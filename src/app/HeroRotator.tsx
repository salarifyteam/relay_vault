"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import s from "./landing.module.css";
import { HERO_ART } from "./HeroArt";

/** Rotating hero — the copy and the illustration each sit on a 3-sided prism
 *  (like a rotating tri-face billboard). Both prisms turn together, one face
 *  per provider value, ~5s each. */
const SLIDES = [
  {
    eyebrow: "Win more customers",
    title: "A lower price wins more customers.",
    sub: "With no AI cost to carry, you can price low and stay flexible. Cheaper means less hesitation — and more signups than onboarding tricks ever buy you.",
  },
  {
    eyebrow: "Security off your hands",
    title: "Never hold a key, never carry the risk.",
    sub: "Users worry about handing you their API key. Relay holds it encrypted instead — you can't see it, so the liability was never yours to begin with.",
  },
  {
    eyebrow: "No heavy-user penalty",
    title: "Your power users stop costing you money.",
    sub: "Metered AI is a hurdle for you and your users alike. Drop it: AI is billed to their own key, so the more they use, the better — never your bill.",
  },
];

const N = SLIDES.length;

/** A face's transform: rotate it into its slot around the X axis, then push it
 *  out by the prism radius so the faces form a drum. */
function faceStyle(index: number, radius: number): React.CSSProperties {
  return {
    transform: `rotateX(${index * (360 / N)}deg) translateZ(${radius}px)`,
  };
}

/** Rotate the whole drum so face `i` faces front. */
function drumStyle(i: number): React.CSSProperties {
  return { transform: `translateZ(-1px) rotateX(${-i * (360 / N)}deg)` };
}

export default function HeroRotator() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % N), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={s.heroInner}>
      <div>
        {/* text prism */}
        <div className={s.prism} style={{ height: 232 }}>
          <div className={s.prismDrum} style={drumStyle(i)}>
            {SLIDES.map((slide, n) => (
              <div
                key={n}
                className={`${s.prismFace} ${n === i ? s.prismFaceOn : ""}`}
                style={faceStyle(n, 232 / (2 * Math.tan(Math.PI / N)))}
                aria-hidden={n !== i}
              >
                <div className={s.eyebrow}>{slide.eyebrow}</div>
                <h1 className={s.heroTitle}>{slide.title}</h1>
                <p className={s.heroSub}>{slide.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={s.heroCtas}>
          <Link href="/login" className={s.btnPrimary}>
            Start free →
          </Link>
          <Link href="/docs" className={s.textLink}>
            Read the docs →
          </Link>
        </div>
        <div className={s.rotatorDots}>
          {SLIDES.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Show value ${n + 1}`}
              className={`${s.rotatorDot} ${n === i ? s.rotatorDotOn : ""}`}
              onClick={() => setI(n)}
            />
          ))}
        </div>
      </div>

      {/* image prism — turns in lockstep with the text */}
      <div className={s.mockWrap}>
        <div className={s.prism} style={{ height: 300 }}>
          <div className={s.prismDrum} style={drumStyle(i)}>
            {HERO_ART.map((Art, n) => (
              <div
                key={n}
                className={`${s.prismFace} ${s.prismFaceArt} ${n === i ? s.prismFaceOn : ""}`}
                style={faceStyle(n, 300 / (2 * Math.tan(Math.PI / N)))}
                aria-hidden={n !== i}
              >
                <Art />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
