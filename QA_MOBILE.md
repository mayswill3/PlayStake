# Mobile QA Checklist — PlayStake Demo Games

## Devices to test
- [ ] iPhone SE (375px) — portrait & landscape
- [ ] iPhone 14 Pro (393px) — portrait & landscape
- [ ] iPad Mini (768px) — portrait & landscape
- [ ] Android phone (360px) — portrait & landscape
- [ ] Desktop (1440px) — no regression

## Landscape lock & rotate prompt
- [ ] Rotate prompt appears on mobile portrait when in playing/finished phase
- [ ] Rotate prompt does NOT appear on desktop
- [ ] Rotate prompt does NOT appear before game starts (role-select, lobby)
- [ ] Rotate prompt disappears when device is rotated to landscape
- [ ] Phone icon animates smoothly (CSS rotateHint keyframes)
- [ ] Prompt overlay covers entire screen with z-[9999]
- [ ] Orientation lock API fires without errors (non-blocking if unsupported)

## Demo games — all 4
- [ ] Tic-Tac-Toe: landscape lock + rotate prompt active during playing/finished
- [ ] Tactical Ops (FPS): landscape lock + rotate prompt active during playing/finished
- [ ] Higher/Lower (Cards): landscape lock + rotate prompt active during playing/finished
- [ ] 8-Ball Pool: landscape lock + rotate prompt active during playing/finished

## Sidebar (navigation)
- [ ] Mobile sidebar width is 75vw (proportional on small phones)
- [ ] Sidebar max-width caps at 16rem (w-64 equivalent)
- [ ] Sidebar open/close still works correctly
- [ ] Desktop sidebar unchanged (fixed w-64)

## Header balance
- [ ] Balance shows on mobile (dollar amount only, no "Balance" label)
- [ ] Balance shows full format on sm+ (label + amount + escrowed)
- [ ] Escrowed amount hidden on mobile, visible on sm+
- [ ] Tapping balance navigates to /wallet on mobile

## General mobile UX
- [ ] No horizontal scroll on any demo game page
- [ ] Game area stacks above widget on single-column mobile layout
- [ ] Touch targets are at least 44x44px
- [ ] Text remains readable at all tested widths
- [ ] No console errors in production build

## Desktop regression
- [ ] All 4 demo games render correctly at 1440px
- [ ] Sidebar is static (not overlaid) on lg+
- [ ] Header balance shows full format
- [ ] Grid layout (game + sidebar) unchanged on lg+
