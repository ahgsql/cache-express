/**
 * Hashes a string to create a unique cache key.
 * @param {string} str - The input string to be hashed.
 * @returns {number} - The generated hash value.
 */
function hashString(str) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const charCode = str.charCodeAt(i);
		hash = ((hash << 5) - hash + charCode) | 0;
	}
	return hash + 2147483647 + 1;
}

/**
 * MemoryCache class for caching data in memory.
 */
class MemoryCache {
	constructor() {
		this.cache = {};
		this.dependencies = {};
	}

	/**
	 * Retrieves a value from the cache.
	 * @param {string} key - The cache key.
	 * @param {Array} depArrayValues - Dependency values for cache checking.
	 * @returns {*} - The cached value if found and not expired, otherwise null.
	 */
	get(key, depArrayValues) {
		const item = this.cache[key];
		const checkDepsChanged = this.dependenciesChanged(key, depArrayValues);

		if (checkDepsChanged) {
			if (item && item.timer) {
				clearInterval(item.timer);
			}
			delete this.cache[key];
			return null;
		}

		if (item && (!item.expireTime || item.expireTime > Date.now())) {
			return item.value;
		} else {
			delete this.cache[key];
			return null;
		}
	}

	/**
	 * Sets a value in the cache with an optional timeout and callback.
	 * @param {string} key - The cache key.
	 * @param {*} value - The value to cache.
	 * @param {number} timeoutMs - Timeout in milliseconds.
	 * @param {function} callback - Callback function when the cache expires.
	 * @param {Array} dependencies - Dependency values for cache checking.
	 */
	set(key, value, timeoutMs, callback, dependencies) {
		if (timeoutMs && timeoutMs > 0) {
			const expireTime = Date.now() + timeoutMs;
			this.cache[key] = { value, expireTime, dependencies, timeoutMs };

			if (callback) {
				this.cache[key].timer = setTimeout(() => {
					if (this.cache[key]) {
						callback(key, this.cache[key].value);
						delete this.cache[key];
					}
				}, timeoutMs);
			}
		} else {
			this.cache[key] = { value, dependencies };
		}

		this.dependencies[key] = dependencies;
	}

	/**
	 * Removes a value from the cache.
	 * @param {string} key - The cache key to remove.
	 */
	remove(key) {
		delete this.cache[key];
		delete this.dependencies[key];
	}

	/**
	 * Checks if a key exists in the cache.
	 * @param {string} key - The cache key to check.
	 * @returns {boolean} - True if the key exists in the cache, otherwise false.
	 */
	has(key) {
		return key in this.cache;
	}

	/**
	 * Checks if the dependencies have changed.
	 * @param {string} key - The cache key.
	 * @param {Array} depArrayValues - Dependency values to compare.
	 * @returns {boolean} - True if the dependencies have changed, otherwise false.
	 */
	dependenciesChanged(key, depArrayValues) {
		const dependencies = this.dependencies[key];

		if (!dependencies) {
			return false;
		}

		const check =
			JSON.stringify(dependencies) === JSON.stringify(depArrayValues);

		if (check) {
			return false;
		} else {
			this.dependencies[key] = depArrayValues;
			return true;
		}
	}
}

const cache = new MemoryCache();

/**
 * Middleware function for Express.js to enable caching.
 *
 * @param {Object} [opts] - Options for caching.
 * @param {Function} [opts.dependsOn=() => []] - A function that returns an array of dependency values for cache checking.
 * @param {number} [opts.timeOut=3600000] - Timeout in milliseconds for cache expiration. Default is 1 hour (3600000 ms).
 * @param {Function} [opts.onTimeout=() => { console.log("Cache removed"); }] - A callback function to execute when a cached item expires.
 * @param {Function} [opts.onCacheMiss=(url: string) => {  }] - A callback function to execute when a request is not found in cache.
 * @param {Function} [opts.onCacheServed=(url: string) => {  }] - A callback function to execute when a cached item is served.
 * @param {Function} [opts.onCacheStored=(url: string) => {  }] - A callback function to execute when a cached item is stored / updated.
 * @returns {function} - Middleware function.
 */
function expressCache(opts = {}) {
	const defaults = {
		dependsOn: () => [],
		timeOut: 60 * 60 * 1000,
		onTimeout: () => {
			console.log("Cache removed");
		},
		onCacheMiss: () => {},
		onCacheServed: () => {},
		onCacheStored: () => {}
	};

	const options = {
		...defaults,
		...opts,
	};

	const { dependsOn, timeOut, onTimeout, onCacheMiss, onCacheServed, onCacheStored } = options;

	return function (req, res, next) {
		const cacheUrl = req.originalUrl || req.url;
		const cacheKey = "c_" + hashString(cacheUrl);
		const depArrayValues = dependsOn();

		const cachedResponse = cache.get(cacheKey, depArrayValues);

		if (cachedResponse) {
			const cachedBody = cachedResponse.body;
			const cachedHeaders = cachedResponse.headers;
			const cachedStatusCode = cachedResponse.statusCode;

			// Set headers that we cached
			if (cachedHeaders) {
				res.set(JSON.parse(cachedHeaders));
			}

			if (typeof cachedBody === "string") {
				try {
					const jsonData = JSON.parse(cachedBody);
					onCacheServed(cacheUrl);
					res.status(cachedStatusCode).json(jsonData);
				} catch (error) {
					onCacheServed(cacheUrl);
					res.status(cachedStatusCode).send(cachedBody);
				}
			} else {
				onCacheServed(cacheUrl);
				res.status(cachedStatusCode).send(cachedBody);
			}
		} else {
			onCacheMiss(cacheUrl);
			const originalSend = res.send;
			const originalJson = res.json;

			res.send = function (body) {
				cache.set(
					cacheKey,
					{
						body: typeof body === "object" ? JSON.stringify(body) : body,
						headers: JSON.stringify(res.getHeaders()),
						statusCode: res.statusCode
					},
					timeOut,
					onTimeout,
					depArrayValues
				);
				onCacheStored(cacheUrl);
				originalSend.call(this, body);
			};

			res.json = function (body) {
				cache.set(cacheKey, {
					body: body,
					headers: JSON.stringify(res.getHeaders()),
					statusCode: res.statusCode
				}, timeOut, onTimeout, depArrayValues);
				onCacheStored(cacheUrl);
				originalJson.call(this, body);
			};

			next();
		}
	};
}
module.exports = expressCache;
module.exports.hash = hashString;
module.exports.MemoryCache = MemoryCache;
