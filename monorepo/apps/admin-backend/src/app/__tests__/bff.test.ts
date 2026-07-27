import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { completeAdminLogin } from "../auth/bff";

function response() {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
    type: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.type.mockReturnValue(res);
  return res;
}

describe("completeAdminLogin", () => {
  it("returns the OAuth denial instead of reporting missing callback parameters", async () => {
    const res = response();

    await completeAdminLogin(
      {
        query: {
          error: "access_denied",
          error_description: "This account is not allowed to use the application.",
          state: "oauth-state",
        },
      } as unknown as Request,
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.type).toHaveBeenCalledWith("text");
    expect(res.send).toHaveBeenCalledWith("This account is not allowed to use the application.");
  });
});
