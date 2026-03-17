import { describe, it, expect } from "vitest";
import { Semaphore } from "../../src/lib/semaphore.js";

describe("Semaphore", () => {
  it("allows up to max concurrent acquires", async () => {
    const sem = new Semaphore(2);
    const order: string[] = [];

    await sem.acquire();
    order.push("a1");
    await sem.acquire();
    order.push("a2");

    // Third acquire should block
    let thirdResolved = false;
    const thirdPromise = sem.acquire().then(() => {
      thirdResolved = true;
      order.push("a3");
    });

    // Give microtask a chance to resolve
    await new Promise((r) => setTimeout(r, 10));
    expect(thirdResolved).toBe(false);

    // Release one — third should now resolve
    sem.release();
    await thirdPromise;
    expect(thirdResolved).toBe(true);
    expect(order).toEqual(["a1", "a2", "a3"]);
  });

  it("processes queue in FIFO order", async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    await sem.acquire();

    const p1 = sem.acquire().then(() => order.push(1));
    const p2 = sem.acquire().then(() => order.push(2));
    const p3 = sem.acquire().then(() => order.push(3));

    sem.release();
    await p1;
    sem.release();
    await p2;
    sem.release();
    await p3;

    expect(order).toEqual([1, 2, 3]);
  });
});
