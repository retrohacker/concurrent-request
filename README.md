# Concurrent Request
Simple [request](https://github.com/request/request) pooling with backoff strategies and jitter.

![logo](./.github/logo.png)

[![Build Status](https://travis-ci.org/retrohacker/request-pool.png?branch=master)](https://travis-ci.org/retrohacker/request-pool)
![](https://img.shields.io/github/issues/retrohacker/request-pool.svg)
![](https://img.shields.io/npm/dm/request-pool.svg)
![](https://img.shields.io/npm/dt/request-pool.svg)
![](https://img.shields.io/npm/v/request-pool.svg)
![](https://img.shields.io/npm/l/request-pool.svg)
![](https://img.shields.io/twitter/url/https/github.com/retrohacker/request-pool.svg?style=social)

[![NPM](https://nodei.co/npm/request-pool.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/request-pool/)
[![NPM](https://nodei.co/npm-dl/request-pool.png?months=9&height=3)](https://nodei.co/npm/request-pool/)

## Usage

```js
const Pool = require('request-pool')
const opts = {
  interval: (count) => Math.pow(2, count) * 1000, // exponentional backoff
  jitter: 1000, // 1 second range of jitter (+/- .5 seconds)
  size: 5, // At most 5 active connections
  tries: 5, // Give up after retrying 5 times
  handler: function (e, resp, body, cb) {
    if(e) { return cb(e); } // Retry if connection fails
    if(resp.code === 429) { return cb(new Error('rate limited')); } // retry
    return cb(null); // The request succeeded
  }
}
var request = new Pool(opts);

request({ uri: 'http://example.foo', method: 'GET', json: true }, function (e, body) {
  if(e) {
    return e.forEach((err) => console.error(err));
  }
  console.log(JSON.stringify(body));
});
```

## API

### `var request = new Pool(opts)`

Create a new pool of [request](https://github.com/request/request) handlers. This pool will limit the number of concurrent requests made through the pool, along with retrying failed requests with backoff and jitter, making your application super friendly to remote APIs.

`opts` is required and is an object of the form:

```js
{
  jitter: Number, // See below for more information
  size: Number, // The maximum number of concurrent requests
  tries: Number, //
  interval: Function, // See below for more information
  handler: Function, // See below for more information
}
```

* `interval` - A function that computes the number of milliseconds to wait before retrying a request. For example `(count) => Math.pow(2, count) * 1000` would retry after 2 seconds, then 4, then 8, then 16, and so on. This defaults to `() => 0` (retry immediately).
* `jitter` - A number that determines the amount of random jitter to apply to the retry interval. If you specify `1000` for example, you will end up with +/- 500ms. The reason for this is to prevent all `size` of your concurrent requests from failing and retrying at the same exact time putting strain on the API endpoint you are hitting. The algorithm used to compute the jitter is: `interval + jitter * (Math.random() - .5)`. This value will default to `0` (which means no jitter).
* `size` - The maximum number of concurrent requests. Defaults to `Infinity`.
* `handler` - A function that determines when the library should attempt to retry. This method signature should be: `function (e, resp, body, cb)` where `e`, `resp`, and `body` are the values received from `request` and the `cb` is an error first callback. If you invoke the callback with an error, the library will retry the request. Otherwise it will treat the request as succesful. Defaults to `() => cb(e)`
* `tries` - The number of times this library should re-attempt a request. Defaults to `0`.

### `request(opts, function callback(e, resp, body) {})`

This method accepts an `opts` object, which is the same exact [`opts`](https://github.com/request/request#requestoptions-callback) accepted by the request module itself.

When invoked, this function will queue the request. When the number of concurrent requests drops below the `size` threshold specified in the constructor, the library will work through this queue.

Once the request has either failed `tries` times or completed, `callback` will be invoked. If the request failed, `e` will be an array of all errors returned by the handler. Otherwise `resp` and `body` will be the same as you would get from the [`request`](https://github.com/request/request) library.

> Note: we do not support any other way of invoking the underlying `request` object at this time. Streams are not supported.
