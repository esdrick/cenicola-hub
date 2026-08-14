import {
  getVenezuelaParts,
  getVenezuelaDateString,
  getVenezuelaCompactDateString,
  getVenezuelaStartOfDay,
  getVenezuelaEndOfDay,
  formatVenezuelaDateTime,
} from "../lib/date-utils";

// Test date at 8:30 PM VET (20:30 VET = 00:30 UTC next day)
// August 13, 2026, 20:30 VET is 2026-08-14T00:30:00Z in UTC.
const nightDateUTC = new Date("2026-08-14T00:30:00Z");

console.log("--- Testing Venezuela Timezone Calculations ---");
console.log("Input UTC Date:", nightDateUTC.toISOString());

const parts = getVenezuelaParts(nightDateUTC);
console.log("Venezuela Parts:", parts);

const dateStr = getVenezuelaDateString(nightDateUTC);
console.log("Venezuela Date String (YYYY-MM-DD):", dateStr);

const compactDateStr = getVenezuelaCompactDateString(nightDateUTC);
console.log("Venezuela Compact Date String (YYYYMMDD):", compactDateStr);

const startOfDay = getVenezuelaStartOfDay(nightDateUTC);
console.log("Start of Day UTC:", startOfDay.toISOString());

const endOfDay = getVenezuelaEndOfDay(nightDateUTC);
console.log("End of Day UTC:", endOfDay.toISOString());

const formatted = formatVenezuelaDateTime(nightDateUTC);
console.log("Formatted VET:", formatted);

// Assertions
if (parts.year === 2026 && parts.month === 8 && parts.day === 13 && parts.hours === 20 && parts.minutes === 30) {
  console.log("✅ SUCCESS: Night order correctly resolved to August 13, 2026, 20:30 VET!");
} else {
  console.error("❌ FAILURE: Incorrect timezone resolution!", parts);
  process.exit(1);
}
