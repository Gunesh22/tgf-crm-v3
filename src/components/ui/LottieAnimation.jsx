import React, { useEffect, useRef } from "react";
import lottie from "lottie-web";

export default function LottieAnimation({ animationData, className = "w-48 h-48", loop = true, autoplay = true }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !animationData) return;

    containerRef.current.innerHTML = "";

    const animInstance = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop,
      autoplay,
      animationData,
    });

    return () => {
      if (animInstance) {
        animInstance.destroy();
      }
    };
  }, [animationData, loop, autoplay]);

  return <div ref={containerRef} className={className} />;
}
