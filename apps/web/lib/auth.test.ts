import { describe, expect, it } from "vitest";
import {
  authRedirect,
  firstNameFromMetadata,
  isValidInvite,
  needsProfileCheck,
  originFrom,
  safeNext,
  usernameError,
  validateLogin,
  validateProfile,
  validateSignup,
} from "./auth";

const goodSignup = {
  firstName: " Ana ",
  username: "Ana_99",
  email: " Ana@Example.com ",
  confirmEmail: "ana@example.COM",
  password: "correct horse",
};

describe("usernameError", () => {
  it.each(["ana", "ana_99", "a1b2c3", "abcdefghijklmnopqrst"])("accepts %s", (u) => {
    expect(usernameError(u)).toBeNull();
  });

  it.each([
    ["too short", "ab"],
    ["too long", "abcdefghijklmnopqrstu"],
    ["starts with digit", "9ana"],
    ["starts with underscore", "_ana"],
    ["uppercase", "Ana"],
    ["dash", "ana-b"],
    ["space", "ana b"],
    ["dot", "ana.b"],
    ["reserved", "admin"],
    ["empty", ""],
  ])("rejects %s", (_label, u) => {
    expect(usernameError(u)).not.toBeNull();
  });
});

describe("validateProfile", () => {
  it("trims the first name and lowercases the username", () => {
    expect(validateProfile({ firstName: "  Mary Ann ", username: " Mary_Ann " })).toEqual({
      ok: true,
      value: { firstName: "Mary Ann", username: "mary_ann" },
    });
  });

  it("reports each bad field", () => {
    const r = validateProfile({ firstName: "   ", username: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["firstName", "username"]);
  });

  it("rejects non-string input", () => {
    expect(validateProfile({ firstName: 1, username: null }).ok).toBe(false);
  });

  it("rejects overly long first names", () => {
    expect(validateProfile({ firstName: "a".repeat(51), username: "ana" }).ok).toBe(false);
  });
});

describe("validateSignup", () => {
  it("normalizes a valid sign-up", () => {
    expect(validateSignup(goodSignup)).toEqual({
      ok: true,
      value: {
        firstName: "Ana",
        username: "ana_99",
        email: "ana@example.com",
        password: "correct horse",
      },
    });
  });

  it("requires matching emails (case-insensitive)", () => {
    const r = validateSignup({ ...goodSignup, confirmEmail: "ana@example.org" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual({ confirmEmail: "Emails don't match" });
  });

  it("rejects an invalid email without a confirm-email error", () => {
    const r = validateSignup({ ...goodSignup, email: "nope", confirmEmail: "nope" });
    expect(!r.ok && Object.keys(r.errors)).toEqual(["email"]);
  });

  it("enforces password length", () => {
    expect(validateSignup({ ...goodSignup, password: "short" }).ok).toBe(false);
    expect(validateSignup({ ...goodSignup, password: "x".repeat(73) }).ok).toBe(false);
    expect(validateSignup({ ...goodSignup, password: "12345678" }).ok).toBe(true);
  });

  it("does not trim passwords", () => {
    const r = validateSignup({ ...goodSignup, password: "  spaced  " });
    expect(r.ok && r.value.password).toBe("  spaced  ");
  });

  it("collects profile and account errors together", () => {
    const r = validateSignup({});
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.errors).sort()).toEqual(["email", "firstName", "password", "username"]);
  });
});

describe("validateLogin", () => {
  it("accepts and normalizes", () => {
    expect(validateLogin({ email: " A@B.co ", password: "pw" })).toEqual({
      ok: true,
      value: { email: "a@b.co", password: "pw" },
    });
  });

  it("requires both fields", () => {
    const r = validateLogin({ email: "", password: "" });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(["email", "password"]);
  });
});

describe("safeNext", () => {
  it.each(["/dashboard", "/lesson/intro?x=1", "/profile#cert", "/"])("keeps %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([
    ["absolute URL", "https://evil.example"],
    ["protocol-relative", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["relative path", "dashboard"],
    ["control char", "/a\nb"],
    ["login loop", "/login?next=/x"],
    ["signup", "/signup"],
    ["onboarding", "/onboarding"],
    ["auth callback", "/auth/callback"],
    ["non-string", ["/a"]],
    ["undefined", undefined],
  ])("falls back for %s", (_label, p) => {
    expect(safeNext(p)).toBe("/profile");
  });

  it("does not treat lookalike prefixes as auth pages", () => {
    expect(safeNext("/loginhelp")).toBe("/loginhelp");
  });
});

describe("authRedirect", () => {
  const anon = { signedIn: false, hasProfile: false, search: "" };
  const noProfile = { signedIn: true, hasProfile: false, search: "" };
  const full = { signedIn: true, hasProfile: true, search: "" };

  it.each(["/profile", "/review", "/admin", "/admin/groups/1"])(
    "sends signed-out users from %s to login with next",
    (pathname) => {
      expect(authRedirect({ ...anon, pathname })).toBe(
        `/login?next=${encodeURIComponent(pathname)}`,
      );
    },
  );

  it("keeps the query string in next", () => {
    expect(authRedirect({ ...anon, pathname: "/review", search: "?a=1" })).toBe(
      `/login?next=${encodeURIComponent("/review?a=1")}`,
    );
  });

  it("sends signed-in users without a profile to onboarding", () => {
    expect(authRedirect({ ...noProfile, pathname: "/profile" })).toBe(
      "/onboarding?next=%2Fprofile",
    );
  });

  it("lets complete users through protected routes", () => {
    expect(authRedirect({ ...full, pathname: "/profile" })).toBeNull();
  });

  it.each([
    "/",
    "/dashboard",
    "/lesson/intro",
    "/pricing",
    "/daily",
    "/profiles-are-not-protected",
  ])("leaves public route %s alone", (pathname) => {
    expect(authRedirect({ ...anon, pathname })).toBeNull();
    expect(authRedirect({ ...noProfile, pathname })).toBeNull();
  });

  it("handles onboarding", () => {
    expect(authRedirect({ ...anon, pathname: "/onboarding" })).toBe("/login?next=%2Fprofile");
    expect(authRedirect({ ...noProfile, pathname: "/onboarding" })).toBeNull();
    expect(authRedirect({ ...full, pathname: "/onboarding", search: "?next=/review" })).toBe(
      "/review",
    );
    expect(
      authRedirect({ ...full, pathname: "/onboarding", search: "?next=https://evil.example" }),
    ).toBe("/profile");
  });

  it("bounces signed-in users away from login and signup", () => {
    expect(authRedirect({ ...anon, pathname: "/login" })).toBeNull();
    expect(authRedirect({ ...anon, pathname: "/signup" })).toBeNull();
    expect(authRedirect({ ...full, pathname: "/login", search: "?next=/review" })).toBe("/review");
    expect(authRedirect({ ...full, pathname: "/signup" })).toBe("/profile");
    expect(authRedirect({ ...noProfile, pathname: "/signup", search: "?completed=intro" })).toBe(
      "/onboarding?next=%2Fprofile",
    );
  });
});

describe("needsProfileCheck", () => {
  it("is true only for routes whose decision depends on the profile", () => {
    expect(needsProfileCheck("/profile")).toBe(true);
    expect(needsProfileCheck("/dashboard")).toBe(false);
    expect(needsProfileCheck("/login")).toBe(true);
    expect(needsProfileCheck("/onboarding")).toBe(true);
    expect(needsProfileCheck("/")).toBe(false);
    expect(needsProfileCheck("/lesson/intro")).toBe(false);
  });
});

describe("originFrom", () => {
  const h = (map: Record<string, string>) => (n: string) => map[n] ?? null;

  it("uses forwarded host and proto (Vercel previews)", () => {
    expect(
      originFrom(
        h({ "x-forwarded-host": "eg-git-x.vercel.app", "x-forwarded-proto": "https" }),
        "https://excelguru.in",
      ),
    ).toBe("https://eg-git-x.vercel.app");
  });

  it("defaults localhost to http and other hosts to https", () => {
    expect(originFrom(h({ host: "localhost:3000" }), undefined)).toBe("http://localhost:3000");
    expect(originFrom(h({ host: "excelguru.in" }), undefined)).toBe("https://excelguru.in");
  });

  it("falls back to the base URL, then localhost", () => {
    expect(originFrom(h({}), "https://excelguru.in/")).toBe("https://excelguru.in");
    expect(originFrom(h({}), undefined)).toBe("http://localhost:3000");
  });

  it("ignores malformed hosts and protocols", () => {
    expect(originFrom(h({ host: "evil.com/path" }), "https://excelguru.in")).toBe(
      "https://excelguru.in",
    );
    expect(
      originFrom(h({ host: "a.com", "x-forwarded-proto": "javascript" }), "https://b.com"),
    ).toBe("https://b.com");
  });
});

describe("firstNameFromMetadata", () => {
  it("prefers explicit first names and keeps them whole", () => {
    expect(firstNameFromMetadata({ first_name: "Mary Ann", full_name: "Mary Ann Lee" })).toBe(
      "Mary Ann",
    );
    expect(firstNameFromMetadata({ given_name: "Ravi" })).toBe("Ravi");
  });

  it("takes the first word of a full name", () => {
    expect(firstNameFromMetadata({ full_name: "  Priya Sharma " })).toBe("Priya");
    expect(firstNameFromMetadata({ name: "Li Wei" })).toBe("Li");
  });

  it("returns empty when nothing usable", () => {
    expect(firstNameFromMetadata(undefined)).toBe("");
    expect(firstNameFromMetadata({ full_name: 3 })).toBe("");
  });
});

describe("isValidInvite", () => {
  it("matches ignoring case and whitespace", () => {
    expect(isValidInvite(" Excel-2026 ", "excel-2026")).toBe(true);
  });
  it("rejects a wrong or missing code", () => {
    expect(isValidInvite("nope", "excel-2026")).toBe(false);
    expect(isValidInvite("", "excel-2026")).toBe(false);
    expect(isValidInvite(undefined, "excel-2026")).toBe(false);
  });
  it("is closed when no code is configured", () => {
    expect(isValidInvite("", "")).toBe(false);
    expect(isValidInvite("anything", undefined)).toBe(false);
  });
});
