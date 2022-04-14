import { describe, test, expect } from "vitest";
import { renderHook } from "@testing-library/react-hooks";
import { ObservableMap } from "hydrogen-view-sdk";

import { useObservableMap } from "../../../src/ui/hooks/useObservableMap";

describe("useObservableMap", () => {
  test("it should return an empty map when passed an undefined value", () => {
    const { result } = renderHook(() => useObservableMap(undefined));

    expect(result.current).toStrictEqual(new Map());
    expect(result.all.length).toBe(1);
  });

  test("it should return a new map when changed", () => {
    const observable = new ObservableMap<string, number>([["a", 1]]);

    const { result } = renderHook(() => useObservableMap(observable));

    observable.update("a", 2);

    expect(result.all.length).toBe(2);
    expect(result.all[0]).not.toBe(result.all[1]);
  });

  test("it should return the first observed value", () => {
    const observable = new ObservableMap<string, number>([["a", 1]]);

    const { result } = renderHook(() => useObservableMap(observable));

    expect(result.current).toStrictEqual(new Map([["a", 1]]));
    expect(observable.hasSubscriptions).toBe(true);
    expect(result.all.length).toBe(1);
  });

  test("it should change when the an item is added", () => {
    const observable = new ObservableMap<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    const { result } = renderHook(() => useObservableMap(observable));

    expect(result.current).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ])
    );

    observable.add("d", 4);

    expect(result.current).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
        ["d", 4],
      ])
    );

    expect(result.all.length).toBe(2);
  });

  test("it should change when the an item is set", () => {
    const observable = new ObservableMap<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    const { result } = renderHook(() => useObservableMap(observable));

    expect(result.current).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ])
    );

    observable.set("b", 4);

    expect(result.current).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 4],
        ["c", 3],
      ])
    );

    expect(result.all.length).toBe(2);
  });

  test("it should change when the an item is removed", () => {
    const observable = new ObservableMap<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    const { result } = renderHook(() => useObservableMap(observable));

    expect(result.current).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ])
    );

    observable.remove("b");

    expect(result.current).toStrictEqual(
      new Map([
        ["a", 1],
        ["c", 3],
      ])
    );
  });

  test("it should change when the observable changes", () => {
    const observable1 = new ObservableMap<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);
    const observable2 = new ObservableMap<string, number>([
      ["d", 4],
      ["e", 5],
      ["f", 6],
    ]);

    const { result, rerender } = renderHook(({ observable }) => useObservableMap(observable), {
      initialProps: { observable: observable1 },
    });

    expect(result.current).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ])
    );
    expect(observable1.hasSubscriptions).toBe(true);

    rerender({ observable: observable2 });

    expect(result.current).toStrictEqual(
      new Map([
        ["d", 4],
        ["e", 5],
        ["f", 6],
      ])
    );
    expect(observable1.hasSubscriptions).toBe(false);
    expect(observable2.hasSubscriptions).toBe(true);

    expect(result.all.length).toBe(2);
  });

  test("it should handle an undefined to observable transition", () => {
    const observable = new ObservableMap<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    const { result, rerender } = renderHook<
      { observable: ObservableMap<string, number> | undefined },
      Map<string, number> | undefined
    >(({ observable }) => useObservableMap(observable), {
      initialProps: { observable: undefined },
    });

    expect(result.current).toStrictEqual(new Map());
    expect(observable.hasSubscriptions).toBe(false);

    rerender({ observable });

    expect(result.current).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ])
    );
    expect(observable.hasSubscriptions).toBe(true);

    expect(result.all.length).toBe(2);
  });

  test("it should handle an observable to undefined transition", () => {
    const observable = new ObservableMap<string, number>([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    const { result, rerender } = renderHook<
      { observable: ObservableMap<string, number> | undefined },
      Map<string, number> | undefined
    >(({ observable }) => useObservableMap(observable), {
      initialProps: { observable },
    });

    expect(result.current).toStrictEqual(
      new Map([
        ["a", 1],
        ["b", 2],
        ["c", 3],
      ])
    );
    expect(observable.hasSubscriptions).toBe(true);

    rerender({ observable: undefined });

    expect(result.current).toStrictEqual(new Map());
    expect(observable.hasSubscriptions).toBe(false);

    expect(result.all.length).toBe(2);
  });
});
