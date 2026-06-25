import React, { useEffect, useState } from 'react';

export default function Confetti({ active, onComplete }) {
  const [show, setShow] = useState(active);

  useEffect(() => {
    if (active) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        if (onComplete) onComplete();
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [active]);

  if (!show) return null;

  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#a855f7', '#6366f1', '#14b8a6'];
  const particles = Array.from({ length: 80 }).map((_, i) => {
    const style = {
      position: 'fixed',
      top: '-20px',
      left: `${Math.random() * 100}vw`,
      width: `${Math.random() * 8 + 6}px`,
      height: `${Math.random() * 14 + 6}px`,
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      transform: `rotate(${Math.random() * 360}deg)`,
      opacity: Math.random() * 0.7 + 0.3,
      zIndex: 9999,
      pointerEvents: 'none',
      animation: `fall-${i % 4} ${Math.random() * 2 + 2}s linear forwards`,
      animationDelay: `${Math.random() * 1.5}s`
    };
    return <div key={i} style={style} />;
  });

  return (
    <>
      <style>
        {`
          @keyframes fall-0 {
            0% { top: -20px; transform: rotate(0deg) translateX(0); }
            100% { top: 105vh; transform: rotate(720deg) translateX(150px); }
          }
          @keyframes fall-1 {
            0% { top: -20px; transform: rotate(0deg) translateX(0); }
            100% { top: 105vh; transform: rotate(-360deg) translateX(-100px); }
          }
          @keyframes fall-2 {
            0% { top: -20px; transform: rotate(0deg) translateX(0); }
            100% { top: 105vh; transform: rotate(540deg) translateX(50px); }
          }
          @keyframes fall-3 {
            0% { top: -20px; transform: rotate(0deg) translateX(0); }
            100% { top: 105vh; transform: rotate(-540deg) translateX(-50px); }
          }
        `}
      </style>
      {particles}
    </>
  );
}
