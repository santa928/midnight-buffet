# Midnight Buffet Visual Reference

- Reference: `public/assets/concepts/midnight-buffet-mobile-reference.png`
- Generated source dimensions: `853x1844`
- Target viewport: `390x844` portrait mobile
- Status: Accepted baseline for initial UI implementation

## World Dictionary

- Background: deep navy banquet hall, burgundy velvet curtains, candlelit brass.
- Stage: oversized gold cloche above a spotlighted porcelain dish.
- Controls: tactile burgundy reservation cards with embossed gold edging.
- Mood: elegant night banquet with a playful reveal-show payoff.

## Keep

- Three anchored regions: slim top HUD, dominant central serving stage, bottom card-and-CTA controls.
- Strong navy, velvet and antique-gold palette with warm candle lighting.
- The cloche and plated dessert as the reveal scene's primary focal point.
- Card shells large enough to support touch-first selection on a portrait phone.

## Adapt

- Render round labels, scores, player names, card values and button labels as accessible HTML text.
- Use generated background, stage and food assets as composited layers so live state can change without raster text.
- Reduce the visible card fan density as needed when all fifteen remaining cards must be selected accessibly.
- Reserve a safe gap between the serving stage and card controls instead of matching the reference by fixed percentages.

## Reject

- Empty decorative HUD medallions that do not correspond to a usable control.
- Any illegible generated lettering or text embedded in imagery.
- Excess gleam, particles or shadows that obscure scores or touch targets.
- Replacing the stage or dishes with rough CSS-only approximations.

## Components

- `Hud`: round / dish count and audio / reduced-motion controls.
- `DishStage`: cloche, dish art, explicit signed score and dish name.
- `ReservationHand`: code-native numbered cards and seal action.
- `RevealTable`: revealed reservations, collisions and winner emphasis.
- `ScoreBoard`: seat cards and obtained dish totals.

## Assets

- Keep this complete screen only as design evidence.
- Accepted stage background source: `assets/source/banquet-stage-source.png` (`853x1844`); shipping version is `public/assets/backgrounds/banquet-stage.webp`.
- The accepted background already integrates the lifted cloche and empty serving platform; implementation overlays dish art rather than stacking a separate cloche asset.
- Accepted positive dish source: `assets/source/jewel-strawberry-tart.png`; shipping version is `public/assets/dishes/jewel-strawberry-tart.webp`.
- Generate additional shipping assets for trouble dishes and final celebration as later visual enrichment, then optimize all source PNG files to WebP from the Docker-managed image conversion step.
- Keep dynamic content in DOM overlays; generated assets provide texture, lighting and physical objects.

## Layout And Tokens

- Background: `#081321`
- Surface: `#101c30`
- Velvet: `#541d2d`
- Gold: `#d7b56d`
- Text: `#fbf2db`
- Positive: `#f4cd72`
- Negative: `#ef7164`
- Touch minimum: `48px`
- Card / panel radii: `18px` / `28px`

## Checks

- Compare implemented reveal and results scenes to this reference at `390x844` and `430x932`.
- Confirm numerically that the card hand and CTA stay below the dish stage with at least `12px` safe gap.
- Confirm the card hand, CTA and score rail stay within the viewport with at least `8px` inset.
- Confirm labels remain readable with sound disabled and reduced motion enabled.
