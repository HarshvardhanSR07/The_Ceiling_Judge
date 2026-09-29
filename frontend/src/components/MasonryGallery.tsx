
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { cn } from "../utils/cn";

const useMedia = (queries: string[], values: number[], defaultValue: number): number => {
  const get = () => {
    if (typeof window === "undefined") return defaultValue;
    const match = queries.findIndex(q => window.matchMedia(q).matches);
    return values[match] !== undefined ? values[match] : defaultValue;
  };
  const [value, setValue] = useState<number>(get);
  useEffect(() => {
    const handler = () => setValue(get);
    queries.forEach(q => window.matchMedia(q).addEventListener("change", handler));
    return () => queries.forEach(q => window.matchMedia(q).removeEventListener("change", handler));
  }, [queries]);
  return value;
};

const useMeasure = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
};

const preloadImages = async (urls: string[]): Promise<void> => {
  await Promise.all(
    urls.map(
      src => new Promise<void>(resolve => {
        if (!src) return resolve();
        const img = new Image();
        img.src = src;
        img.onload = img.onerror = () => resolve();
      })
    )
  );
};

export interface MasonryItem {
  bgPosition?: string;
  bgSize?: string;
  id: string;
  img: string;
  url?: string;
  height: number;
  title?: string;
}

interface GridItem extends MasonryItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MasonryGalleryProps {
  items: MasonryItem[];
  ease?: string;
  duration?: number;
  stagger?: number;
  animateFrom?: "bottom" | "top" | "left" | "right" | "center" | "random";
  scaleOnHover?: boolean;
  hoverScale?: number;
  blurToFocus?: boolean;
  colorShiftOnHover?: boolean;
  className?: string;
  itemClassName?: string;
}

export const MasonryGallery: React.FC<MasonryGalleryProps> = ({
  items, ease = "power3.out", duration = 0.6, stagger = 0.05, animateFrom = "bottom",
  scaleOnHover = true, hoverScale = 0.95, blurToFocus = true, colorShiftOnHover = false,
  className, itemClassName
}) => {
  const columns = useMedia(
    ["(min-width: 1500px)", "(min-width: 1000px)", "(min-width: 600px)", "(min-width: 400px)"],
    [4, 3, 2, 1],
    1
  );
  const [containerRef, { width }] = useMeasure<HTMLDivElement>();
  const [imagesReady, setImagesReady] = useState(false);
  const hasMounted = useRef(false);

  const getInitialPosition = (item: GridItem) => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return { x: item.x, y: item.y };
    let direction = animateFrom;
    if (animateFrom === "random") {
      const dirs = ["top", "bottom", "left", "right"];
      direction = dirs[Math.floor(Math.random() * dirs.length)] as any;
    }
    switch (direction) {
      case "top": return { x: item.x, y: -200 };
      case "bottom": return { x: item.x, y: window.innerHeight + 200 };
      case "left": return { x: -200, y: item.y };
      case "right": return { x: window.innerWidth + 200, y: item.y };
      case "center": return { x: containerRect.width / 2 - item.w / 2, y: containerRect.height / 2 - item.h / 2 };
      default: return { x: item.x, y: item.y + 100 };
    }
  };

  useEffect(() => {
    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));
  }, [items]);

  const { grid, containerHeight } = useMemo(() => {
    if (!width) return { grid: [] as GridItem[], containerHeight: 0 };
    const colHeights = new Array(columns).fill(0);
    const gap = 24;
    const totalGaps = (columns - 1) * gap;
    const columnWidth = (width - totalGaps) / columns;
    const gridItems = items.map(child => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = col * (columnWidth + gap);
      const height = (child.height / 400) * columnWidth;
      const y = colHeights[col];
      colHeights[col] += height + gap;
      return { ...child, x, y, w: columnWidth, h: height };
    });
    return { grid: gridItems, containerHeight: Math.max(...colHeights) };
  }, [columns, items, width]);

  useLayoutEffect(() => {
    if (!imagesReady || !grid.length) return;
    grid.forEach((item, index) => {
      const element = document.querySelector(`[data-key="masonry-${item.id}"]`);
      if (!element) return;
      const animProps = { x: item.x, y: item.y, width: item.w, height: item.h };
      if (!hasMounted.current) {
        const start = getInitialPosition(item);
        gsap.fromTo(
          element,
          { opacity: 0, x: start.x, y: start.y, width: item.w, height: item.h, ...(blurToFocus && { filter: "blur(20px)" }) },
          { opacity: 1, ...animProps, ...(blurToFocus && { filter: "blur(0px)" }), duration: 1.2, ease: "power3.out", delay: index * stagger }
        );
      } else {
        gsap.to(element, { ...animProps, duration, ease, overwrite: "auto" });
      }
    });
    if (grid.length > 0) hasMounted.current = true;
  }, [grid, imagesReady, stagger, animateFrom, blurToFocus, duration, ease]);

  const handleMouseEnter = (id: string, element: HTMLElement) => {
    if (scaleOnHover) gsap.to(element, { scale: hoverScale, duration: 0.4, ease: "power2.out" });
    if (colorShiftOnHover) {
      const overlay = element.querySelector(".color-overlay");
      if (overlay) gsap.to(overlay, { opacity: 0.3, duration: 0.4 });
    }
  };

  const handleMouseLeave = (id: string, element: HTMLElement) => {
    if (scaleOnHover) gsap.to(element, { scale: 1, duration: 0.4, ease: "power2.out" });
    if (colorShiftOnHover) {
      const overlay = element.querySelector(".color-overlay");
      if (overlay) gsap.to(overlay, { opacity: 0, duration: 0.4 });
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)} style={{ height: containerHeight, minHeight: "400px" }}>
      {grid.map(item => (
        <div 
          key={item.id} 
          data-key={`masonry-${item.id}`} 
          className={cn("absolute overflow-hidden cursor-pointer rounded-xl transition-shadow hover:shadow-2xl", itemClassName)} 
          style={{ willChange: "transform, width, height, opacity, filter", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.05)" }} 
          onClick={() => item.url && window.open(item.url, "_blank", "noopener")} 
          onMouseEnter={e => handleMouseEnter(item.id, e.currentTarget)} 
          onMouseLeave={e => handleMouseLeave(item.id, e.currentTarget)}
        >
          {item.img ? (
            <div className="w-full h-full bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${item.img})`, backgroundPosition: item.bgPosition || "center", backgroundSize: item.bgSize || "cover" }}>
              {colorShiftOnHover && <div className="color-overlay absolute inset-0 bg-gradient-to-tr from-accent-purple/40 to-accent-cyan/40 opacity-0 pointer-events-none transition-opacity" />}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 border border-white/10 rounded-xl relative">
               {colorShiftOnHover && <div className="color-overlay absolute inset-0 bg-gradient-to-tr from-accent-purple/20 to-accent-cyan/20 opacity-0 pointer-events-none transition-opacity" />}
               <span className="text-white/60 text-sm">{item.title}</span>
            </div>
          )}
          {item.title && item.img && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
              <p className="text-white text-xs font-medium uppercase tracking-wider">{item.title}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};


