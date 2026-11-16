import { describe, expect, it } from "vitest";
import { Sheet } from "../src/index";

describe("date formulas", () => {
  it("uses the fixed today for TODAY and NOW", () => {
    const sheet = new Sheet([["=TODAY()", "=NOW()"]], { today: "2026-01-15" });
    expect(sheet.get("A1")).toBe(46037);
    expect(sheet.get("B1")).toBe(46037);
  });
  it("defaults today to a valid date", () => expect(new Sheet([["=TODAY()"]]).get("A1")).toEqual(expect.any(Number)));
  it("marks DATE results as dates", () => expect(new Sheet([["=DATE(2024,3,15)"]]).isDate("A1")).toBe(true));
  it("marks DATEVALUE results as dates", () => expect(new Sheet([["=DATEVALUE(\"2024-03-15\")"]]).isDate("A1")).toBe(true));
  it("marks TODAY results as dates", () => expect(new Sheet([["=TODAY()"]], { today: "2026-01-15" }).isDate("A1")).toBe(true));
  it("marks EDATE and EOMONTH results as dates", () => {
    const s = new Sheet([["=EDATE(DATE(2024,1,31),1)", "=EOMONTH(DATE(2024,1,1),1)"]]);
    expect(s.isDate("A1")).toBe(true); expect(s.isDate("B1")).toBe(true);
  });
  it("marks WORKDAY results as dates", () => expect(new Sheet([["=WORKDAY(DATE(2024,3,15),1)"]]).isDate("A1")).toBe(true));
  it("marks date plus and minus numbers as dates", () => {
    const s = new Sheet([["=DATE(2024,3,15)+3", "=A1-2"]]);
    expect(s.isDate("A1")).toBe(true); expect(s.isDate("B1")).toBe(true);
  });
  it("does not mark numeric results without date provenance", () => expect(new Sheet([["=45366+1"]]).isDate("A1")).toBe(false));
  it("keeps typed date text as text", () => expect(new Sheet([["2024-03-15"]]).isDate("A1")).toBe(false));
  it("recalculates date provenance after edits", () => {
    const s = new Sheet([["=DATE(2024,3,15)"]]); s.set("A1", "=1+2"); expect(s.isDate("A1")).toBe(false);
  });
  it("returns #NUM! when DATEDIF starts after it ends", () => {
    expect(new Sheet([["=DATEDIF(DATE(2024,3,15),DATE(2024,1,15),\"D\")"]]).get("A1")).toEqual({ error: "#NUM!" });
  });
  it("DATEDIF Y returns complete years", () => expect(new Sheet([["=DATEDIF(DATE(2020,1,1),DATE(2024,1,1),\"Y\")"]]).get("A1")).toBe(4));
  it("DATEDIF M returns complete months", () => expect(new Sheet([["=DATEDIF(DATE(2020,1,15),DATE(2020,4,14),\"M\")"]]).get("A1")).toBe(2));
  it("DATEDIF D returns elapsed days", () => expect(new Sheet([["=DATEDIF(DATE(2024,1,1),DATE(2024,1,31),\"D\")"]]).get("A1")).toBe(30));
  it("DATEDIF YM returns remaining months", () => expect(new Sheet([["=DATEDIF(DATE(2020,1,15),DATE(2021,4,14),\"YM\")"]]).get("A1")).toBe(2));
  it("DATEDIF YD returns days ignoring years", () => expect(new Sheet([["=DATEDIF(DATE(2020,1,1),DATE(2021,3,1),\"YD\")"]]).get("A1")).toBe(60));
});
