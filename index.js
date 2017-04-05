'use strict';

const request = require('request');

const Pool = function Pool(o) {
  // State for our object
  const self = {};
  const opt = typeof o === 'object' ? o : {};

  // Initialize with opt objects
  self.tries = opt.tries | 0; // eslint-disable-line no-bitwise
  self.jitter = opt.jitter | 0; // eslint-disable-line no-bitwise
  self.size = opt.size | 0; // eslint-disable-line no-bitwise
  if (self.size === 0) { self.size = Infinity; }
  self.interval =
    typeof opt.interval === 'function' ? opt.interval : () => 0;
  self.handler =
    typeof opt.handler === 'function' ? opt.handler : (e, r, b, cb) => cb(e);

  // Setup initial state
  self.requests = 0;
  self.queue = [];

  return (opts, callback) => {
    const cb = (typeof callback === 'function') ? callback : () => {};
    // Put new request at the end of the queue
    self.queue.push({ opts, cb, try: 0, e: [] });
    next.apply(self); // eslint-disable-line no-use-before-define
  };
};

function next() {
  const self = this;
  // Handle the condition where we are already at capacity or no work left
  if (self.requests >= self.size || self.queue.length === 0) {
    return null;
  }
  const attempt = self.queue.shift();
  // Handle the condition where this request has been retried tries times
  if (attempt.try >= self.tries) {
    next.call(self); // Kick off the next request
    return attempt.cb(attempt.e); // call the user's callback with an error
  }
  // Increment active requests
  self.requests += 1;
  const delay = (attempt.try === 0) ?
    0 : // Don't add jitter to first attempt
    self.interval(attempt.try) + (self.jitter * (Math.random() - 0.5));

  // Throttle our request
  setTimeout(() => {
    request(attempt.opts, (e, resp, body) => {
      // eslint-disable-next-line no-use-before-define
      done.call(self, e, resp, body, attempt);
    });
  }, delay);
  return null;
}

function done(e, resp, body, attempt) {
  const self = this;
  self.requests -= 1;
  // Ask the user if the request was a success
  self.handler(e, resp, body, (err) => {
    if (!err) {
      // If successful, kick off the next request and call the user's callback
      next.call(self);
      return attempt.cb(null, resp, body);
    }

    // Add err to the list of errors for the attempt
    attempt.e.push(err);
    // Have request be retried next
    attempt.try += 1; // eslint-disable-line no-param-reassign
    self.queue.unshift(attempt);
    // Retry request
    return next.call(self);
  });
}

module.exports = Pool;
