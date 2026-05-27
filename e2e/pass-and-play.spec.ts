import { expect, test, type Page } from "@playwright/test";

test("plays a full short feast without exposing sealed reservations", async ({ page }, testInfo) => {
  test.slow();
  await page.goto("./?qa=initial-release-1");
  await page.getByLabel("プレイヤー 1 の名前").fill("あおい");
  await page.getByLabel("プレイヤー 2 の名前").fill("れん");
  await page.getByRole("button", { name: "祝宴を始める" }).click();

  await expect(page.getByText("次は あおい さん")).toBeVisible();
  await expect(page.getByRole("button", { name: "予約札 15" })).toHaveCount(0);

  for (let round = 0; round < 9; round += 1) {
    await chooseCard(page, 15 - round);
    await expect(page.getByText("次は れん さん")).toBeVisible();
    await expect(page.getByRole("button", { name: `予約札 ${15 - round}`, exact: true })).toHaveCount(0);
    await chooseCard(page, 1 + round);
    await expect(page.getByRole("button", { name: "クロッシュを開ける" })).toBeVisible();

    await page.getByRole("button", { name: "クロッシュを開ける" }).click();
    if (round === 0) {
      await page.screenshot({ path: testInfo.outputPath("reveal.png"), fullPage: true });
    }
    if (round < 8) {
      await page.getByRole("button", { name: "次の皿へ" }).click();
    }
  }

  await expect(page.getByText("今宵の表彰")).toBeVisible();
  await expect(page.getByRole("button", { name: "もう一度乾杯" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("results.png"), fullPage: true });
  await page.getByRole("button", { name: "もう一度乾杯" }).click();
  await expect(page.getByText("次は あおい さん")).toBeVisible();
});

test("keeps the dish stage and private controls separated inside the viewport", async ({ page }, testInfo) => {
  await page.goto("./?qa=layout-check");
  await page.getByLabel("プレイヤー 1 の名前").fill("あおい");
  await page.getByLabel("プレイヤー 2 の名前").fill("れん");
  await page.getByRole("button", { name: "祝宴を始める" }).click();
  await openHand(page);
  await page.screenshot({ path: testInfo.outputPath("selection-layout.png"), fullPage: true });

  const stage = await page.getByTestId("dish-stage").boundingBox();
  const hand = await page.getByTestId("card-hand").boundingBox();
  const cta = await page.getByTestId("primary-cta").boundingBox();
  const viewport = page.viewportSize();
  const lastCard = page.getByRole("button", { name: "予約札 15", exact: true });

  expect(stage).not.toBeNull();
  expect(hand).not.toBeNull();
  expect(cta).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (!stage || !hand || !cta || !viewport) {
    return;
  }
  expect(stage.y + stage.height + 12).toBeLessThanOrEqual(hand.y);
  expect(hand.x + hand.width).toBeLessThanOrEqual(viewport.width - 8);
  expect(cta.y + cta.height).toBeLessThanOrEqual(viewport.height - 8);

  await lastCard.scrollIntoViewIfNeeded();
  const visibleLastCard = await lastCard.boundingBox();
  expect(visibleLastCard).not.toBeNull();
  if (visibleLastCard) {
    expect(visibleLastCard.x).toBeGreaterThanOrEqual(8);
    expect(visibleLastCard.x + visibleLastCard.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(visibleLastCard.y + visibleLastCard.height).toBeLessThanOrEqual(cta.y - 8);
  }
});

async function chooseCard(page: Page, value: number): Promise<void> {
  await openHand(page);
  await page.getByRole("button", { name: `予約札 ${value}`, exact: true }).click();
  await page.getByRole("button", { name: "この札を封蝋する" }).click();
}

async function openHand(page: Page): Promise<void> {
  const curtainButton = page.getByRole("button", { name: "長押しして手札を開く" });
  await curtainButton.dispatchEvent("pointerdown", { pointerId: 1, pointerType: "touch" });
  await expect(page.getByTestId("card-hand")).toBeVisible();
}
