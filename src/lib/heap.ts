export class MinHeap<T> {
  private data: T[] = [];

  constructor(private readonly before: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.data.length;
  }

  push(value: T): void {
    this.data.push(value);
    this.siftUp(this.data.length - 1);
  }

  pop(): T | undefined {
    const heap = this.data;
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last !== undefined) {
      heap[0] = last;
      this.siftDown(0);
    }
    return top;
  }

  private siftUp(index: number): void {
    const heap = this.data;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(heap[index], heap[parent])) return;
      [heap[index], heap[parent]] = [heap[parent], heap[index]];
      index = parent;
    }
  }

  private siftDown(index: number): void {
    const heap = this.data;
    const length = heap.length;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;
      if (left < length && this.before(heap[left], heap[best])) best = left;
      if (right < length && this.before(heap[right], heap[best])) best = right;
      if (best === index) return;
      [heap[index], heap[best]] = [heap[best], heap[index]];
      index = best;
    }
  }
}
