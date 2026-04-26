export const TaskTypes = {
  EXTRACT_MAIN_WEBSITE: "ExtractMainWebsite",
  EXTRACT_SUB_WEBSITE: "ExtractSubWebsite",
  COMPARE_MATCH_DETAIL: "CompareMatchDetail"
};

export class TaskQueue {
  constructor() {
    this.queue = [];
  }

  push(task) {
    this.queue.push(task);
  }

  pop() {
    if (this.queue.length === 0) return null;
    return this.queue.shift();
  }

  size() {
    return this.queue.length;
  }
}
