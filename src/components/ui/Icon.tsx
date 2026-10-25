import type { SVGProps } from "react";

const PATHS = {
  tag: "M3 12V4.5A1.5 1.5 0 0 1 4.5 3H12l9 9-9 9-9-9Zm4.5-4.5h.01",
  nfc: "M6 8.5a5 5 0 0 1 0 7M9.5 6a8.5 8.5 0 0 1 0 12M13 3.5a12 12 0 0 1 0 17M17 7l2 2-2 2",
  droplet: "M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z",
  shield: "M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Z",
  alert: "M12 4 2.8 19.5h18.4L12 4Zm0 6v4.5m0 2.5h.01",
  check: "m5 12.5 4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  clipboard: "M9 4h6v3H9zM7 5.5H5.5V21h13V5.5H17M8.5 11h7m-7 4h5",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 19h14",
  upload: "M12 16V5m0 0-4 4m4-4 4 4M5 19h14",
  camera: "M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6m-6 4h6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5",
  phone: "M5 4h4l1.5 4.5-2.3 1.4a11 11 0 0 0 5.9 5.9l1.4-2.3L20 15v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1Z",
  plus: "M12 5v14M5 12h14",
  wifi: "M3 9.5a13 13 0 0 1 18 0M6.5 13a8 8 0 0 1 11 0M10 16.5a3 3 0 0 1 4 0M12 20h.01",
  wifiOff: "M3 3l18 18M8.5 5.4A13 13 0 0 1 21 9.5M3 9.5a13 13 0 0 1 3.1-2.2M6.5 13a8 8 0 0 1 4-2M10 16.5a3 3 0 0 1 4 0M12 20h.01",
  sparkles: "M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.5 2.5m6.4 6.4 2.5 2.5m0-11.4-2.5 2.5m-6.4 6.4-2.5 2.5",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  arrowRight: "M5 12h14m0 0-5-5m5 5-5 5",
  box: "M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Zm0 0 8 4.5m0 0 8-4.5M12 12v9",
  activity: "M3 12h4l2.5-6 5 12 2.5-6H21",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  heart: "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20Z",
  refresh: "M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4m-4 5a8 8 0 0 0 14.6 4.5M20 20v-4h-4",
  trash: "M5 7h14M10 11v6m4-6v6M8 7l1-3h6l1 3m-9 0 1 13h8l1-13",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4"
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5", ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
