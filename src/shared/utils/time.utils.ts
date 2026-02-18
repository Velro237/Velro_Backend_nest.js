export const TimeMs = {
  SECOND: 1000,
  MINUTE: 60000,
  HOUR: 3600000,
  DAY: 86400000,
  seconds: (s: number) => Math.max(0, s * 1000),
  minutes: (m: number) => Math.max(0, m * 60000),
  hours: (h: number) => Math.max(0, h * 3600000),
  days: (d: number) => Math.max(0, d * 86400000),
};

type ToHMSOutput = {
  implicit: string;
  explicit: string;
};

export const Duration = {
  msToHMS: (ms: number): ToHMSOutput => {
    const seconds = Math.floor(ms / TimeMs.SECOND) % 60;
    const minutes = Math.floor(ms / TimeMs.MINUTE) % 60;
    const hours = Math.floor(ms / TimeMs.HOUR);

    const h = hours.toString().padStart(2, '0');
    const m = minutes.toString().padStart(2, '0');
    const s = seconds.toString().padStart(2, '0');

    return { implicit: `${h}:${m}:${s}`, explicit: `${h}h ${m}m ${s}s` };
  },
};
