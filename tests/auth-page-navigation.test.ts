import assert from "node:assert/strict";
import test from "node:test";
import {
  navigateToAuthPage,
  type AuthPageNavigationEvent,
} from "../src/lib/navigation/auth-page-navigation";

function event(overrides: Partial<AuthPageNavigationEvent> = {}) {
  let prevented = false;
  const value: AuthPageNavigationEvent = {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => {
      prevented = true;
    },
    ...overrides,
  };
  return { value, prevented: () => prevented };
}

test("a primary auth-page click uses a document navigation", () => {
  const click = event();
  const assigned: string[] = [];

  const handled = navigateToAuthPage(click.value, "/register", {
    assign: (href) => assigned.push(href),
  });

  assert.equal(handled, true);
  assert.equal(click.prevented(), true);
  assert.deepEqual(assigned, ["/register"]);
});

test("modified and non-primary clicks preserve native browser behavior", () => {
  for (const overrides of [
    { button: 1 },
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { defaultPrevented: true },
  ]) {
    const click = event(overrides);
    const assigned: string[] = [];

    const handled = navigateToAuthPage(click.value, "/register", {
      assign: (href) => assigned.push(href),
    });

    assert.equal(handled, false);
    assert.equal(click.prevented(), false);
    assert.deepEqual(assigned, []);
  }
});
