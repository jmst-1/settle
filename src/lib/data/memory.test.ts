import { beforeEach, describe, expect, it } from "vitest";
import { ensureUser, findUserByEmail, resetSnapshot, setProfile } from "@/lib/data/memory";

describe("first-run preferred name", () => {
  beforeEach(() => {
    resetSnapshot(true);
  });

  it("marks seed users as already onboarded", () => {
    const alice = findUserByEmail("alice@example.com");
    expect(alice?.onboardedAt).toBeTruthy();
  });

  it("creates new users without onboardedAt", () => {
    const user = ensureUser({
      id: "usr_new",
      email: "new.friend@example.com",
      name: "New.friend",
    });
    expect(user.onboardedAt).toBeFalsy();
  });

  it("sets onboardedAt when the profile name is saved", () => {
    const user = ensureUser({
      id: "usr_new",
      email: "new.friend@example.com",
      name: "New.friend",
    });
    const state = setProfile(user.id, "Jordan", "");
    expect(state?.currentUser.name).toBe("Jordan");
    expect(state?.currentUser.onboardedAt).toBeTruthy();
  });
});
