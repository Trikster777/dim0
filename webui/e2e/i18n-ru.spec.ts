import { test, expect } from "@playwright/test"

import { LANG_STORAGE_KEY } from "./setup"


// One smoke for the Russian locale: the suite runs in English by default (see
// e2e/setup.ts), so this test pins `ru` itself, checks a few visible strings on
// the main screen and the chats entry, then switches back to English through the
// sidebar picker — proving the runtime switch, not just the dictionary.
test("Russian interface: main screen, chats entry, back to English", async ({ page }) => {
  const missingKeyWarnings: string[] = []
  page.on("console", (message) => {
    if (/missingKey|missing key/i.test(message.text())) missingKeyWarnings.push(message.text())
  })

  await page.addInitScript(([key]) => localStorage.setItem(key, "ru"), [LANG_STORAGE_KEY])

  await page.goto("/")
  await expect(page.locator("html")).toHaveAttribute("lang", "ru")
  await expect(page.getByRole("heading", { name: "На этом устройстве" })).toBeVisible()
  await expect(
    page.getByRole("list", { name: "На этом устройстве" }).getByText("Новая доска"),
  ).toBeVisible()
  await expect(page.getByText("Доски заметок").first()).toBeVisible()

  // Signed out, the chats route bounces to sign-in — that screen is Russian too.
  await page.goto("/chats")
  await expect(page).toHaveURL(/\/signin/)
  await expect(page.getByRole("textbox", { name: "Эл. почта" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Войти" })).toBeVisible()

  expect(missingKeyWarnings, missingKeyWarnings.join("\n")).toEqual([])

  await page.goto("/")
  // The shell starts with the sidebar closed; open it to reach the language picker.
  await page.getByRole("button", { name: "Переключить боковую панель" }).click()
  await page.getByRole("button", { name: "Сменить язык" }).click()
  await page.getByRole("menuitem", { name: "English" }).click()
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await expect(page.getByRole("heading", { name: "On this device" })).toBeVisible()
  await expect(
    page.getByRole("list", { name: "On this device" }).getByText("New Board"),
  ).toBeVisible()
  expect(await page.evaluate((key) => localStorage.getItem(key), LANG_STORAGE_KEY)).toBe("en")
})
