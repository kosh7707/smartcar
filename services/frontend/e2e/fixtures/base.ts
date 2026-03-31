/**
 * Extended Playwright test fixture with auto-configured API mocking.
 * Every test gets `mockApi` pre-attached.
 */
import { test as base } from "@playwright/test";
import { MockApi, createMockApi } from "../helpers/api-mocker";

type Fixtures = {
  mockApi: MockApi;
};

export const test = base.extend<Fixtures>({
  mockApi: async ({ page }, use) => {
    const mock = await createMockApi(page);
    await use(mock);
  },
});

export { expect } from "@playwright/test";
