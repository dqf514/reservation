import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiUrl, assetUrl, setToken } from "./api";

describe("apiUrl / assetUrl", () => {
  it("apiUrl 拼接相对路径", () => {
    expect(apiUrl("/api/x")).toMatch(/\/api\/x$/);
  });

  it("assetUrl 空值返回 undefined", () => {
    expect(assetUrl(null)).toBeUndefined();
    expect(assetUrl("")).toBeUndefined();
  });

  it("assetUrl 保留绝对 URL", () => {
    expect(assetUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
  });
});

describe("apiFetch", () => {
  afterEach(() => {
    setToken(null);
    vi.restoreAllMocks();
  });

  it("发送 JSON 并解析响应", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ ok: true, value: 1 }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const out = await apiFetch<{ ok: boolean; value: number }>("/api/demo", {
      json: { a: 1 },
    });
    expect(out.ok).toBe(true);
    expect(out.value).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init?.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("附带 Authorization", async () => {
    setToken("test-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({}),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/me");
    const init = fetchMock.mock.calls[0][1] as RequestInit & { headers?: Headers };
    const h = init.headers as Headers;
    expect(h.get("Authorization")).toBe("Bearer test-token");
  });

  it("非 2xx 抛出带详情的 Error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ detail: "参数错误" }),
      } as Response),
    );

    await expect(apiFetch("/api/x")).rejects.toThrow("参数错误");
  });
});
