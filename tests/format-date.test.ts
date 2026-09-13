import { describe, expect, it } from "vitest";
import {
  ISRAEL_TIME_SUFFIX,
  formatDateTime,
  formatDay,
  formatEditionDate,
  formatSourceDay,
} from "@/lib/format-date";

/* Fixed instants, chosen so the zone matters: each is one day in UTC and
   another in Jerusalem, or sits on a DST boundary. */
describe("lib/format-date — the one reader-facing date policy", () => {
  it("dates a summer instant in Jerusalem (UTC+3), en-GB, day first", () => {
    /* 14:07 UTC on 12 September is 17:07 in Jerusalem. */
    expect(formatDay("2026-09-12T14:07:00Z")).toBe("12 Sept 2026");
    expect(formatDateTime("2026-09-12T14:07:00Z")).toBe("12 Sept 2026, 17:07");
  });

  it("crosses the day boundary the way the desk does, not the way UTC does", () => {
    /* 21:05 UTC on 31 August is 00:05 on 1 September in Jerusalem. */
    expect(formatDay("2026-08-31T21:05:32Z")).toBe("1 Sept 2026");
    expect(formatDateTime("2026-08-31T21:05:32Z")).toBe("1 Sept 2026, 00:05");
    /* A publisher's date stays on the publisher's UTC day. */
    expect(formatSourceDay("2026-08-31T21:05:32Z")).toBe("31 Aug 2026");
  });

  it("follows Israel's clock change (2026: last Friday of March, last Sunday of October)", () => {
    /* Winter (UTC+2): 15:00 UTC on 1 February is 17:00. */
    expect(formatDateTime("2026-02-01T15:00:00Z")).toBe("1 Feb 2026, 17:00");
    /* Clocks go forward 02:00 -> 03:00 on Friday 27 March 2026: 00:30 UTC is
       03:30, not 02:30. */
    expect(formatDateTime("2026-03-27T00:30:00Z")).toBe("27 Mar 2026, 03:30");
    /* Clocks go back on Sunday 25 October 2026: 00:30 UTC is 02:30 again. */
    expect(formatDateTime("2026-10-25T00:30:00Z")).toBe("25 Oct 2026, 02:30");
  });

  it("names an edition by its own calendar day, with the weekday and the year", () => {
    expect(formatEditionDate("2026-09-12")).toBe("Sat 12 Sept 2026");
    expect(formatEditionDate("2026-01-01")).toBe("Thu 1 Jan 2026");
    /* Winter and summer alike: the anchor sits inside the named day. */
    expect(formatEditionDate("2026-03-27")).toBe("Fri 27 Mar 2026");
    expect(formatEditionDate("2026-10-25")).toBe("Sun 25 Oct 2026");
  });

  it("does not care what zone the process runs in", () => {
    const previous = process.env.TZ;
    try {
      for (const zone of ["UTC", "Pacific/Honolulu", "Asia/Jerusalem"]) {
        process.env.TZ = zone;
        expect(formatDay("2026-08-31T21:05:32Z")).toBe("1 Sept 2026");
        expect(formatEditionDate("2026-09-12")).toBe("Sat 12 Sept 2026");
        expect(formatSourceDay("2026-08-31T21:05:32Z")).toBe("31 Aug 2026");
      }
    } finally {
      process.env.TZ = previous;
    }
  });

  it("returns unparseable input as it came rather than 'Invalid Date'", () => {
    expect(formatDay("not a date")).toBe("not a date");
    expect(formatDateTime("")).toBe("");
    expect(formatEditionDate("2026-13-45")).toBe("2026-13-45");
    expect(formatSourceDay("soon")).toBe("soon");
  });

  it("names whose clock a time is", () => {
    expect(ISRAEL_TIME_SUFFIX).toBe(" · Israel time");
  });
});
