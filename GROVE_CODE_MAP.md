# Enchanted grove: population and growth source map

Step 1: identify the upstream code. No application has been created yet.

Source: https://github.com/srizzon/git-city
Pinned commit: 9aeead41abd258910b5d20b7240fc31fe0b2aee4
Selected original files are preserved under reference/git-city with the upstream LICENSE (AGPL-3.0). These files are reference material, not a runnable extraction; they depend on other upstream modules.

## Growth calculations
- src/lib/city-layout-core.ts: calcHeight (line 10), calcHeightV2 (43), calcWidthV2 (83), calcDepthV2 (97), calcLitPercentageV2 (115). These convert GitHub metrics into dimensions and illumination. The legacy height composite weights contributions 55%, stars 35%, repositories 10%; the newer formula combines six metrics. Heights range from 35 to 600 upstream world units.
- Same file: resolveNorms and computeLayoutNorms normalize metrics across the population; hashStr and seededRandom provide stable visual variation.
- src/lib/github.ts: DeveloperRecord and CityBuilding are the input/output contracts; generateCityLayout (302) handles layout entry, and calcBuildingDims (799) exposes dimension calculation.

## Population and placement
- src/lib/city-sf-layout.ts: generateSFCityLayout and selectPlacedDevelopers implement the SF layout path. Inspect this alongside the legacy placement in github.ts before choosing an adaptation.
- src/lib/city-lots.ts: assignCityLot calls a database RPC to allocate a fixed address. This is persistence-backed placement, not standalone geometry logic.
- src/lib/create-developer.ts: createDeveloperFromGitHub creates a population member from GitHub data.
- src/app/api/city/route.ts: serves developer records and city metadata from the database.

## Rendering and animation
- src/components/Building3D.tsx: BuildingRiseAnimation (281) scales the building upward during reveal; Building3D (524) renders individual buildings.
- src/components/InstancedBuildings.tsx: renders many buildings efficiently and contains an instanced rise animation. Reuse the batching concept, but replace building geometry and window materials with trunks, canopies, flowers, and magical glow.
- src/components/CityScene.tsx: connects layout output to the scene.

## Ongoing data refresh
- src/app/api/cron/refresh-buildings/route.ts: updates contributions from GitHub. It replaces the current-year slice in the stored lifetime total to avoid double-counting. This changes the metrics used for size; it is separate from reveal animation.

## Proposed next step (requires form semantics)
1. Define a GroveRecord from the future form; do not retain GitHub field names.
2. Decide what one plant represents and which answers drive height, canopy size, flowers, and glow.
3. Implement pure grove size calculations with explicit bounds and stable ID-based variation.
4. Implement stable grove placement so new submissions do not move existing plants.
5. Replace building rendering with grove geometry, then wire a form adapter to the same pipeline.

Open decisions: form field names and units conversion, preferred plant types and visual style. The agreed population is one plant per person, with submitted hours determining height.

## Step 2: grove population and growth translation
`src/lib/grove.ts` defines a form-neutral `GrovePerson`, a configurable linear `plantHeight` mapping, deterministic positions, and `buildGrove`. Each stable person ID yields one plant; duplicate IDs use the last record so updated hours resize the same plant. Supply `GroveScale` from the eventual form/product configuration. The module does not assume form field names or a particular hours-to-height ratio.

