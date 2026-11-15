import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLocalProgress, readLocalProgress, writeLocalProgress, mergeLocalProgress, LOCAL_PROGRESS_KEY } from "./local-progress";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

describe("local progress", () => {
  beforeEach(() => { vi.stubGlobal("localStorage", storage()); vi.stubGlobal("fetch", vi.fn()); });
  it("returns empty progress when no key exists", () => expect(readLocalProgress()).toEqual([]));
  it("writes and reads lesson attempts", () => { writeLocalProgress("intro", [{ stepId: "s", input: "x", showedAnswer: false }]); expect(readLocalProgress()).toHaveLength(1); });
  it("stores multiple lessons", () => { writeLocalProgress("intro", []); writeLocalProgress("next", []); expect(readLocalProgress()).toHaveLength(2); });
  it("replaces prior entry for same lesson", () => { writeLocalProgress("intro", []); writeLocalProgress("intro", [{ stepId: "s", input: "2", showedAnswer: true }]); expect(readLocalProgress()).toHaveLength(1); });
  it("ignores corrupt JSON", () => { localStorage.setItem(LOCAL_PROGRESS_KEY, "{"); expect(readLocalProgress()).toEqual([]); });
  it("ignores invalid JSON shape", () => { localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify({ nope: 1 })); expect(readLocalProgress()).toEqual([]); });
  it("clears key", () => { writeLocalProgress("intro", []); clearLocalProgress(); expect(localStorage.getItem(LOCAL_PROGRESS_KEY)).toBeNull(); });
  it("posts and clears only on success", async () => { vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 200 })); writeLocalProgress("intro", []); expect(await mergeLocalProgress()).toBe(true); expect(fetch).toHaveBeenCalledWith("/api/progress/merge", expect.anything()); expect(readLocalProgress()).toEqual([]); });
  it("keeps local data on failed response", async () => { vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 500 })); writeLocalProgress("intro", []); expect(await mergeLocalProgress()).toBe(false); expect(readLocalProgress()).toHaveLength(1); });
  it("keeps local data on network error", async () => { vi.mocked(fetch).mockRejectedValueOnce(new Error("offline")); writeLocalProgress("intro", []); expect(await mergeLocalProgress()).toBe(false); expect(readLocalProgress()).toHaveLength(1); });
  it("shares one in-flight merge and starts a fresh request after it settles", async () => {
    let resolve!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((r) => { resolve = r; })).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    writeLocalProgress("intro", []);
    const first = mergeLocalProgress();
    const second = mergeLocalProgress();
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve(new Response("{}", { status: 200 }));
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    writeLocalProgress("intro", []);
    expect(await mergeLocalProgress()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("shares a failed in-flight merge and keeps local data", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((_r, r) => { reject = r; }));
    writeLocalProgress("intro", []);
    const first = mergeLocalProgress();
    const second = mergeLocalProgress();
    reject(new Error("offline"));
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    expect(readLocalProgress()).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
