import { v4 as uuidv4 } from 'uuid';

class PostQueue {
  constructor() {
    this.items = [];
    this.history = [];
  }

  add(post) {
    const entry = {
      id: uuidv4(),
      createdAt: Date.now(),
      status: 'pending',
      ...post,
    };
    this.items.unshift(entry);
    return entry;
  }

  getAll() {
    return [...this.items];
  }

  getPending() {
    return this.items.filter(p => p.status === 'pending');
  }

  getById(id) {
    return this.items.find(p => p.id === id);
  }

  approve(id) {
    const post = this.getById(id);
    if (post && post.status === 'pending') {
      post.status = 'approved';
      return post;
    }
    return null;
  }

  markPosted(id, result) {
    const idx = this.items.findIndex(p => p.id === id);
    if (idx !== -1) {
      const [post] = this.items.splice(idx, 1);
      post.status = 'posted';
      post.postedAt = Date.now();
      post.result = result;
      this.history.unshift(post);
      return post;
    }
    return null;
  }

  markFailed(id, error) {
    const post = this.getById(id);
    if (post) {
      post.status = 'failed';
      post.error = error;
    }
    return post;
  }

  reject(id) {
    const post = this.getById(id);
    if (post) {
      post.status = 'rejected';
    }
    return post;
  }

  getHistory(limit = 20) {
    return this.history.slice(0, limit);
  }

  getStats() {
    return {
      pending: this.items.filter(p => p.status === 'pending').length,
      approved: this.items.filter(p => p.status === 'approved').length,
      posted: this.history.filter(p => p.status === 'posted').length,
      failed: this.history.filter(p => p.status === 'failed').length,
      totalGenerated: this.items.length + this.history.length,
    };
  }
}

export const postQueue = new PostQueue();
