import { describe, expect, it } from "vitest";
import { penalizeAbandoned } from "./rating";

const field = (abandoned: string[], n = 8) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, place: i + 1, abandoned: abandoned.includes(`p${i + 1}`) }));
const places = (entries: { id: string; place: number }[]) => Object.fromEntries(entries.map((e) => [e.id, e.place]));

describe("penalizeAbandoned", () => {
  it("drops an away player out of the top half and moves the rest up", () => {
    expect(places(penalizeAbandoned(field(["p2"])))).toEqual({ p1: 1, p2: 5, p3: 2, p4: 3, p5: 4, p6: 6, p7: 7, p8: 8 });
  });

  it("can't take the win in heads-up", () => {
    expect(places(penalizeAbandoned(field(["p1"], 2)))).toEqual({ p1: 2, p2: 1 });
  });

  it("leaves bottom-half finishes and present players alone", () => {
    expect(places(penalizeAbandoned(field(["p6"])))).toEqual(places(field([])));
    expect(places(penalizeAbandoned(field([])))).toEqual(places(field([])));
  });

  it("keeps several away players in their original order", () => {
    expect(places(penalizeAbandoned(field(["p1", "p3"])))).toEqual({ p1: 5, p2: 1, p3: 6, p4: 2, p5: 3, p6: 4, p7: 7, p8: 8 });
  });
});
