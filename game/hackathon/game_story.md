Tod the frog is our Santa, who has to deliver gifts for 
children's for this Christmas.   

Unfortunately the weather was has gotten bad. 
Tod the santa lost control of his vehicle. were  flying from air 

He keeps hold of the sleigh, but the gifts are thrown out of it, and the
storm carries them off one after the other. It will not let them fall -- they
are still up there, turning in the wind.

So our Santa flies after them. Tode and his empty sack stay aboard the sleigh
for the whole of it, and he catches the gifts in the air.
Let's say the no. of gifts need to be caught is 5/5.

With all 5 in the sack he flies on to the five houses near by, and delivers a
present to each of the five houses by dropping it over the house as he passes.










---

### Assets for this story

Which model covers which beat, and how big each one actually is.

**Sizes are true world-space bounds**, measured by walking each file's node
transforms. The raw accessor `min`/`max` in a glTF are per-primitive and in
each mesh's own local space, so on a multi-node model — which all of these
are — reading them directly gives numbers that are wrong, sometimes wildly.
`a_gift_box.glb` reads as `2.5 × 37.5 × 2.17` that way and is really
`225 × 293 × 225`.

Units are the model's own. For scale: Tode is **16.0 wide and 17.0 tall**
with the Santa hat on, a house is **80 to the ridge**, and `WORLD_RADIUS`
is **700**.

| Story beat | Asset | Size (own units) | Tris | Status |
|---|---|---|---|---|
| Tode is Santa | `tode.glb` + `SantaSuit.js` | 1.00 × 0.63 × 0.76 | 10,740 | Stopgap. Real asset specced in `skeleton/tode_the_santa/appearance` |
| The vehicle — and the player, for the whole game | `snow_sleigh.glb` | 4.64 × 1.55 × 1.67 | 99,163 | ✅ rigged. The `run` clip animates its **four humanoid riders**, not the sleigh, and they are kept |
| Gifts flying in the air, and placed at a door | `a_gift_box.glb` | 225 × 293 × 225 | 123,440 | ✅ |
| Carrying the gifts back | `christmas_gift_sack.glb` | 2.34 × 2.36 × 2.57 | 14,201 | ✅ |
| The sack once delivered | `empty_christmas_sack.glb` | 2.34 × 2.29 × 2.57 | 2,816 | ✅ same size as the full one, so it is a straight swap |
| The five houses | `winter_country_house.glb` | — | — | ✅ already placed, `HOUSE_COUNT = 5` |
| The field they stand in | `river_landscape.glb` | — | — | ✅ already placed |
| — | `airport.glb` | 3000 × 11 × 1577 | 1,300 | ⚠️ nothing in the story uses it |
| — | `airport_airplane.glb` | 40.3 × 13.6 × 50.5 | 17,712 | ⚠️ nothing in the story uses it |
| — | `enemy.glb` | — | 3,200 | Unwired. No monsters in this story |

#### Three things this table raises

- **The sleigh's riders are animated, not the sleigh.** Four skinned
  humanoids — 61 joints each, `Bip002`-named, with mouth and eye bones — and
  the `run` clip is 495 channels over their skeletons. Not reindeer. They are
  12,288 of the file's 99,163 triangles and they are being kept, style
  mismatch and all, because stripping them leaves the clip animating nothing.
  `Animation.js` will drive it with no new code.
- **The vehicle is the sleigh.** Settled. The plane and the airport are
  spares, and the airport is not a prop in any case — at 3000 × 1577 it is
  the size of the whole map, so using it would mean a second location rather
  than a second object.
- **Gift boxes are expensive.** 123,440 triangles each, against 252,390 for
  the entire town. Five on screen at once is roughly 617k. Not a download
  question — this project runs locally — but it is the first thing to
  decimate if the frame rate drops.
