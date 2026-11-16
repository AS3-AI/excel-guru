import { describe, expect, it } from "vitest";
import { Sheet } from "../src/index";

describe("date formulas", () => {
  it("uses the fixed today for TODAY and NOW", () => {
    const sheet = new Sheet([["=TODAY()", "=NOW()"]], { today: "2026-01-15" });
    expect(sheet.get("A1")).toBe(46037);
    expect(sheet.get("B1")).toBe(46037);
  });
  it("defaults today to a valid date", () => expect(new Sheet([["=TODAY()"]]).get("A1")).toEqual(expect.any(Number)));
  it("defaults today to match local date parts", () => {
    const d = new Date();
    const expected = (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000;
    expect(new Sheet([["=TODAY()"]]).get("A1")).toBe(expected);
  });
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
  it("DATEDIF YD handles end month/day before start month/day", () => expect(new Sheet([["=DATEDIF(DATE(2024,6,1),DATE(2025,3,1),\"YD\")"]]).get("A1")).toBe(273));
  it("DATEDIF YD handles leap-year crossing", () => expect(new Sheet([["=DATEDIF(DATE(2023,12,1),DATE(2024,3,1),\"YD\")"]]).get("A1")).toBe(91));
  it("DATEDIF YD same-year case unchanged", () => expect(new Sheet([["=DATEDIF(DATE(2024,1,1),DATE(2024,3,1),\"YD\")"]]).get("A1")).toBe(60));
  it("coerces cell date text in DATEDIF", () => {
    const s = new Sheet([["1998-08-20", "2026-01-15", '=DATEDIF(A1,B1,"Y")']]);
    expect(s.get("C1")).toBe(27);
  });
  it("coerces literal date text in DATEDIF", () => {
    expect(new Sheet([['=DATEDIF("1998-08-20","2026-01-15","Y")']]).get("A1")).toBe(27);
  });
  it("subtracts date text cells without marking the result as a date", () => {
    const s = new Sheet([["1998-08-20", "2026-01-15", "=B1-A1"]]);
    expect(s.get("C1")).toBe(10010);
    expect(s.isDate("C1")).toBe(false);
  });
  it("subtracts TODAY from literal date text", () => {
    const s = new Sheet([['="2026-02-01"-TODAY()']], { today: "2026-01-15" });
    expect(s.get("A1")).toBe(17);
    expect(s.isDate("A1")).toBe(false);
  });
  it("adds number to date text", () => {
    const s = new Sheet([["1998-08-20", "=A1+10", '="1998-08-20"+10']]);
    expect(s.get("B1")).toBe(36037);
    expect(s.get("C1")).toBe(36037);
  });
  it("keeps non-date text as #VALUE! in DATEDIF and arithmetic", () => {
    expect(new Sheet([['=DATEDIF("not-a-date","2026-01-15","Y")']]).get("A1")).toEqual({ error: "#VALUE!" });
    expect(new Sheet([['="not-a-date"+1']]).get("A1")).toEqual({ error: "#VALUE!" });
    expect(new Sheet([['="2026-01-15"-"not-a-date"']]).get("A1")).toEqual({ error: "#VALUE!" });
  });
  it("accepts dd-mmm-yyyy date text in DATEDIF and arithmetic", () => {
    expect(new Sheet([['=DATEDIF("20-Aug-1998","15-Jan-2026","Y")']]).get("A1")).toBe(27);
    expect(new Sheet([['="15-Jan-2026"-"20-Aug-1998"']]).get("A1")).toBe(10010);
  });
});
