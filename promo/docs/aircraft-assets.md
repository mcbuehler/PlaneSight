# Aircraft variants

Created with the built-in image-generation tool. All sprites face upward in an
orthographic top-down view and have transparent backgrounds.

| Airline | Type | Project asset |
| --- | --- | --- |
| Cloud Code | Narrowbody, two engines | `public/airlines/cloud-code-narrowbody-orange.png` |
| Cloud Code | Widebody, four engines | `public/airlines/cloud-code-widebody-orange.png` |
| OpenAir | Narrowbody, two engines | `public/airlines/openair-plane-top-down.png` (existing sprite) |
| OpenAir | Widebody, four engines | `public/airlines/openair-widebody.png` |

The `airframe` prop selects the variant in `CloudCodePlane`, `OpenAirPlane`, and
`AirportAircraft`. The airport uses three narrowbodies and three widebodies;
widebodies are also drawn larger. The `PixelAirlines` composition displays all
four variants, and the widebodies have individual preview compositions.

## Generation prompts

### Cloud Code narrowbody

Use case: precise-object-edit. Edit target: the supplied top-down Cloud Code pixel-art aircraft sprite. Change every blue livery detail to saturated warm orange: tail, winglets, engine stripes, fuselage accents, and the Cloud Code lettering. Dark blue livery becomes burnt orange; bright blue becomes bright orange. Keep white/silver surfaces, the slim narrowbody shape, exactly two engines, nose pointing straight up, wing and tail proportions, center alignment, and crisp pixel-art edge treatment unchanged. Keep the lettering exactly "Cloud" on left wing and "Code" on right wing and make it easy to read. One entire isolated aircraft only, no shadow, no ground, no caption or border. Genuine transparent background; preserve clean alpha edges. Same square centered composition, aircraft almost filling square with a small transparent safety margin.

### Cloud Code widebody

Use case: precise-object-edit. Create a WIDEBODY VARIANT of the supplied Cloud Code pixel-art aircraft sprite for the same top-down airport game. Strict orthographic overhead camera, nose pointing straight up, symmetrical and centered. Make a distinctly bigger jumbo passenger aircraft: broad thick twin-aisle fuselage, massive swept wings, exactly FOUR clearly visible large engines (two under each wing), substantial horizontal tail. Keep the same crisp outlined pixel-art shading and restrained white/silver surfaces as reference. All livery accents must be warm ORANGE, not blue: orange tail, orange engine stripes, orange winglets, orange fuselage stripe. Dark burnt-orange block lettering exactly "Cloud" on left wing and "Code" on right wing. It must read clearly as a chunky widebody, visibly broader than the reference, not merely a recolored identical narrow plane. Entire isolated aircraft, genuine transparent background, no cast shadow, no scene, no text outside aircraft. Square canvas with 5% transparent safety margin all sides. Do not crop wingtips or tail.

### OpenAir widebody

Use case: precise-object-edit. Create a WIDEBODY VARIANT of the supplied OpenAir pixel-art aircraft sprite for the same top-down airport game. Strict orthographic overhead camera, nose pointing straight up, symmetrical and centered. Make a distinctly bigger jumbo passenger aircraft: broad thick twin-aisle fuselage, massive swept wings, exactly FOUR clearly visible large engines (two under each wing), substantial horizontal tail. Keep the same crisp outlined pixel-art shading, green tail and engine stripes, dark green wing lettering, and white/silver surfaces as reference. Lettering must be exactly "Open" on left wing and "Air" on right wing. It must read clearly as a chunky widebody, visibly broader than the reference, not merely the identical narrow plane. Entire isolated aircraft, genuine transparent background, no cast shadow, no ground, no scene, no text outside aircraft. Square canvas with 5% transparent safety margin all sides. Do not crop wingtips or tail.
